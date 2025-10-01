# Plasmic Database Scaling Issues - Design Review

## Executive Summary

This document outlines critical database scaling issues identified in Plasmic's current architecture that will impact system performance and reliability as the platform scales. The analysis reveals fundamental architectural decisions that create bottlenecks and potential failure modes affecting all teams simultaneously.

## Current Architecture Overview

### Database Schema Organization
- **Single shared schema** for all teams and projects
- **No tenant isolation** at the database level
- **Shared tables** for teams, projects, users, permissions, CMS data
- **Application-level isolation** through foreign keys and query filtering

### Connection Management
- **Default pool size**: 15 connections per server instance
- **Migration pool size**: 10 connections
- **PostgreSQL fetcher pools**: 20 connections per data source
- **Transaction-per-request** model

## Critical Scaling Issues

### 1. Connection Pool Exhaustion

**Issue**: Limited connection pools create severe bottlenecks under load.

**Current Configuration**:
```typescript
// From DbCon.ts
maxConnections: opts?.defaultPoolSize ?? 15  // Only 15 connections total
migrationPoolSize: opts?.migrationPoolSize ?? 10  // 10 for migrations
```

**Impact**:
- 15+ concurrent requests per server instance cause queuing
- Long-running queries hold connections, blocking other operations
- Cascading failures as requests timeout waiting for connections

**Trigger Cases**:
- Multiple teams editing simultaneously
- Large CMS queries or data exports
- Bulk operations (publishing, importing)
- Real-time collaboration with many concurrent users

### 2. Table-Level Locking Affecting All Teams

**Issue**: Database locks impact all teams due to shared schema architecture.

**Current Behavior**:
- All teams share the same `team`, `project`, `user`, `permission` tables
- Table-level locks from migrations, maintenance, or long-running queries affect everyone
- No database-level isolation between tenants

**Impact**:
- Single team's heavy operation can block all other teams
- Migration operations lock entire tables
- Maintenance windows affect all users simultaneously

**Trigger Cases**:
- Database migrations or schema changes
- Long-running analytical queries
- Bulk data operations (imports, exports)
- Database maintenance or backups

### 3. N+1 Query Problems

**Issue**: Inefficient query patterns cause excessive database round trips.

**Examples from Codebase**:
```typescript
// From PLASMIC_FIRST_API_CALL_ANALYSIS.md
const revisions = await Promise.all(
  projectIdsAndBranches.map(async (p) => {
    const branches = await dbMgr.listBranchesForProject(p.id); // N+1 query
    const matchingBranch = branches.find(branch => branch.name === p.branchName);
    return [p.id, await dbMgr.getLatestProjectRevNumber(p.id, { branchId })]; // Another N+1
  })
);
```

**Impact**:
- Exponential increase in database queries with data volume
- Connection pool exhaustion from excessive queries
- Poor response times for operations involving multiple entities

**Trigger Cases**:
- Loading projects with multiple branches
- Permission checks across multiple resources
- CMS queries with related data
- Bulk operations on collections

### 4. Inefficient Permission Checking

**Issue**: Complex permission queries executed on every request.

**Current Implementation**:
```typescript
// From DbMgr.ts - Complex multi-table joins for permissions
private async getPermissionsForResources(taggedResourceIds: TaggedResourceIds) {
  // Multiple subqueries for workspace and team permissions
  let workspaceQb = this.entMgr.createQueryBuilder()
    .select("p.workspaceId", "workspaceId")
    .from(Project, "p")
    .innerJoin("p.workspace", "w")
    .where(`p.id IN (:...ids)`, { ids: resourceIds });
  // ... more complex joins and subqueries
}
```

**Impact**:
- Every request requires complex permission validation
- Multiple database round trips for permission checks
- Poor performance for operations involving multiple resources

**Trigger Cases**:
- Loading project lists with permission filtering
- Bulk operations requiring permission validation
- Real-time collaboration with frequent permission checks

### 5. Transaction Scope Issues

**Issue**: Every request creates a full database transaction.

**Current Model**:
```typescript
// From AppServer.ts - Transaction per request
req.activeTransaction = req.con.transaction((txMgr) => {
  // Every request gets a full transaction
  // Long-running requests hold connections
});
```

**Impact**:
- Long-running requests hold database connections
- Connection pool exhaustion from held transactions
- Potential deadlocks from transaction conflicts

**Trigger Cases**:
- Large file uploads or data imports
- Complex operations requiring multiple database calls
- Real-time collaboration with frequent updates

### 6. CMS Query Inefficiencies

**Issue**: CMS operations lack proper optimization and indexing.

**Current Implementation**:
```typescript
// From DbMgr.ts - CMS queries with potential performance issues
async queryCmsRows(tableId: CmsTableId, query: ApiCmsQuery) {
  const table = await this.getCmsTableById(tableId); // Separate query
  await this.checkCmsDatabasePerms(table.databaseId, "viewer"); // Another query
  
  let builder = this.cmsRows().createQueryBuilder("r")
    .where("r.tableId = :tableId", { tableId })
    .andWhere("r.deletedAt IS NULL");
  // Complex query building with JSONB operations
}
```

**Impact**:
- JSONB queries without proper indexing
- Multiple queries for single operations
- Poor performance with large CMS datasets

**Trigger Cases**:
- Large CMS tables with complex queries
- JSONB field searches and filtering
- Bulk CMS operations

## Performance Degradation Patterns

### 1. Linear Degradation
- **Connection pool exhaustion**: Performance degrades linearly with concurrent users
- **Query complexity**: Response times increase with data volume

### 2. Exponential Degradation
- **N+1 queries**: Performance degrades exponentially with collection sizes
- **Permission checks**: Multiple resource operations become exponentially slower

### 3. Cascading Failures
- **Connection exhaustion**: Leads to request queuing and timeouts
- **Table locks**: Block all teams, causing widespread service degradation

## Specific Failure Modes

### Connection Pool Exhaustion
**Symptoms**:
- Request timeouts
- "Connection pool exhausted" errors
- Cascading service degradation

**Root Cause**:
- Limited pool size (15 connections)
- Long-running transactions
- N+1 query patterns

### Table Lock Contention
**Symptoms**:
- All teams experience slowdowns simultaneously
- Database operations timeout
- Service-wide outages during maintenance

**Root Cause**:
- Shared schema architecture
- Table-level locks from migrations
- Long-running analytical queries

### Memory Pressure
**Symptoms**:
- Out of memory errors
- Connection drops
- Data corruption

**Root Cause**:
- Large project revisions stored as text/blob
- Inefficient JSONB queries
- No proper pagination limits

## Scaling Bottlenecks

### 1. Single Database Instance
- No read replicas for query distribution
- No horizontal scaling capabilities
- Single point of failure

### 2. Shared Schema Architecture
- No tenant isolation
- Cross-tenant performance impact
- Difficult to optimize for specific use cases

### 3. Synchronous Operations
- No async processing for heavy operations
- Blocking operations hold resources
- No background job processing

### 4. Limited Caching
- Heavy reliance on database for every request
- No intelligent cache warming
- Cache invalidation inefficiencies

### 5. Query Optimization Gaps
- Many queries not optimized for scale
- Missing indexes on frequently queried fields
- Inefficient JSONB operations

## Recommended Mitigation Strategies

### Short-term (Immediate)
1. **Increase connection pool sizes** to handle current load
2. **Implement query optimization** for identified N+1 patterns
3. **Add database indexes** for frequently queried fields
4. **Implement request-level caching** for permission checks

### Medium-term (3-6 months)
1. **Implement read replicas** for query distribution
2. **Add connection pooling** at the application level
3. **Optimize CMS queries** with proper indexing
4. **Implement async processing** for heavy operations

### Long-term (6+ months)
1. **Consider tenant isolation** strategies (schema-per-tenant or database-per-tenant)
2. **Implement horizontal scaling** with database sharding
3. **Add comprehensive caching** layers
4. **Implement background job processing** for heavy operations

## Risk Assessment

### High Risk
- **Connection pool exhaustion**: Immediate impact on all users
- **Table locking**: Service-wide outages
- **N+1 queries**: Exponential performance degradation

### Medium Risk
- **Permission checking inefficiencies**: Gradual performance degradation
- **CMS query performance**: Impact on content-heavy applications
- **Transaction scope issues**: Resource contention

### Low Risk
- **Memory pressure**: Manageable with proper monitoring
- **Cache inefficiencies**: Performance impact but not service-breaking

## Monitoring and Alerting Recommendations

### Critical Metrics
- Database connection pool utilization
- Query response times (especially for N+1 patterns)
- Table lock duration and frequency
- Transaction duration and conflicts

### Alerting Thresholds
- Connection pool utilization > 80%
- Query response time > 2 seconds
- Table locks > 30 seconds
- Transaction conflicts > 10 per minute

## Conclusion

Plasmic's current database architecture has fundamental scaling limitations that will impact system performance and reliability as the platform grows. The shared schema approach, while simplifying development, creates significant bottlenecks and failure modes that affect all teams simultaneously.

Immediate attention is required for connection pool management and query optimization, while longer-term architectural changes should be planned to address the fundamental scaling limitations.

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Review Status**: Draft for Design Review
