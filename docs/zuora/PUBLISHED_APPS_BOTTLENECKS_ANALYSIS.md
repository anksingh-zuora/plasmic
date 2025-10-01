# Published Plasmic Apps - Performance Bottlenecks Analysis

## Executive Summary

This document analyzes the specific performance bottlenecks and scaling issues that affect **published Plasmic apps** (both loader-based and exported components) when they are deployed and serving end users. Unlike the development/studio environment, published apps face different challenges related to runtime performance, caching, and data source execution.

## Published App Architecture Overview

### Two Deployment Models

#### 1. **Loader-Based Apps** (Dynamic)
- Components loaded at runtime via Plasmic loader
- 3 API calls: version resolution → code generation → data execution
- S3/CDN caching for code bundles
- Real-time data source execution

#### 2. **Exported Components** (Static)
- Components pre-built and bundled into the host application
- No runtime API calls to Plasmic servers
- Static assets served from host application
- Data sources executed locally or via host app APIs

## Critical Bottlenecks for Published Apps

### 1. **Database Connection Pool Exhaustion**

**Issue**: Published apps compete with studio users for the same database connection pool.

**Current Impact**:
```typescript
// From DbCon.ts - Shared pool for all operations
maxConnections: opts?.defaultPoolSize ?? 15  // Only 15 connections total
```

**Published App Triggers**:
- **High traffic websites** with many concurrent users
- **Popular components** being loaded simultaneously
- **Data source execution** during peak usage
- **CDN cache misses** forcing database lookups

**Specific Cases**:
```javascript
// Every loader request hits database for version resolution
GET /api/v1/loader/code/published?projectId=xxx
// Database queries: projects, pkg, pkg_version, branches

// Data source execution hits database
POST /api/v1/server-data/sources/xxx/execute
// Database queries: data_sources, data_source_operations
```

### 2. **S3 Cache Miss Performance Degradation**

**Issue**: Non-prefilled versions require on-demand code generation.

**Performance Impact**:
```javascript
// From PLASMIC_PUBLISHED_MODE_ANALYSIS.md
// Prefilled Versions (Fast Path)
- S3 Cache Hit: ~50ms response time
- No code generation: Pre-computed output
- CDN Cached: URL can be cached for hours

// Non-Prefilled Versions (Slow Path)  
- Code Generation: ~2-5 seconds
- S3 Storage: Store for future requests
- Database Update: Mark as prefilled
```

**Trigger Cases**:
- **Newly published versions** not yet prefilled
- **Cache invalidation** due to LOADER_CACHE_BUST changes
- **S3 cache misses** during high load
- **Prefill process failures** leaving versions non-prefilled

### 3. **Data Source Execution Bottlenecks**

**Issue**: Every data source call hits Plasmic's database and external APIs.

**Current Flow**:
```javascript
// Call 3: Data Source Execution
POST /api/v1/server-data/sources/ayzRnGzboUx8cZE6Dxysmt/execute
// Database queries: data_sources, data_source_operations
// External API calls: CMS, databases, REST APIs
```

**Bottleneck Sources**:

#### **Database Queries Per Request**:
```sql
-- Every data source execution requires:
SELECT * FROM data_sources WHERE id = 'xxx';
SELECT * FROM data_source_operations WHERE id = 'xxx';
-- Plus permission checks and validation
```

#### **External API Dependencies**:
- **CMS queries** with complex JSONB operations
- **Database connections** to external PostgreSQL/MySQL
- **REST API calls** to third-party services
- **Authentication overhead** for each external service

**High-Impact Cases**:
- **E-commerce sites** with product catalogs
- **Content-heavy sites** with large CMS datasets
- **Real-time data** requiring frequent updates
- **Complex queries** with joins and filtering

### 4. **CDN Cache Invalidation Cascades**

**Issue**: Cache invalidation affects all published apps simultaneously.

**Cache Architecture**:
```javascript
// Multi-level caching system
1. CDN/CloudFront: URL-based caching (s-maxage=30)
2. S3 Codegen Cache: Pre-computed bundles
3. S3 Bundle Cache: Final JS/CSS output
```

**Invalidation Triggers**:
```javascript
// From PLASMIC_PUBLISHED_MODE_ANALYSIS.md
// When LOADER_CACHE_BUST changes:
// - All S3 cache entries become invalid
// - New cache entries created with new version
// - Old entries eventually expire
```

**Cascade Effects**:
- **Global cache invalidation** affects all published apps
- **Massive S3 regeneration** during cache bust events
- **Database load spikes** from cache miss handling
- **Performance degradation** across all customers

### 5. **Connection Pool Contention**

**Issue**: Published apps and studio operations compete for database connections.

**Shared Resources**:
```typescript
// Same connection pool used for:
- Studio operations (editing, publishing)
- Published app loader requests
- Data source executions
- CMS operations
- Background jobs
```

**Contention Scenarios**:
- **Peak usage hours** when both studio and published apps are active
- **Large deployments** with many published apps
- **Data-heavy applications** with frequent data source calls
- **Real-time features** requiring constant database access

### 6. **Memory Pressure from Large Bundles**

**Issue**: Large component bundles consume significant server memory.

**Bundle Generation**:
```javascript
// From PLASMIC_PUBLISHED_MODE_ANALYSIS.md
// Bundle Cache Key Structure:
// bundle/cb=20/loaderVersion=10/ps=xxx@0.0.2/platform=react/browserOnly=true/opts=...
```

**Memory Issues**:
- **Large projects** with many components and assets
- **Complex styling** with extensive CSS generation
- **Image assets** loaded into memory during processing
- **Multiple platform variants** (React, Next.js, Gatsby)

**Trigger Cases**:
- **Design system components** with extensive variants
- **Image-heavy projects** with large asset collections
- **Complex animations** and interactions
- **Multi-platform builds** for different frameworks

## Specific Failure Modes

### 1. **Cache Stampede**
**Symptoms**:
- Sudden performance degradation across all published apps
- Database connection pool exhaustion
- S3 request rate limiting

**Root Cause**:
- Cache invalidation event (LOADER_CACHE_BUST change)
- All published apps simultaneously request non-cached versions
- Database overwhelmed by version resolution queries

### 2. **Data Source Timeout Cascades**
**Symptoms**:
- Published apps show loading states indefinitely
- Database connections held by slow external API calls
- Connection pool exhaustion

**Root Cause**:
- Slow external APIs (CMS, databases, REST services)
- No timeout handling for data source execution
- Connection leaks from failed requests

### 3. **Prefill Process Failures**
**Symptoms**:
- Newly published versions perform poorly
- Manual intervention required to trigger prefill
- Inconsistent performance across versions

**Root Cause**:
- Prefill worker failures or queue backlogs
- S3 storage issues during prefill process
- Database transaction failures during prefill

## Scaling Bottlenecks

### 1. **Single Database Instance**
- All published apps share the same database
- No read replicas for query distribution
- Single point of failure for all customers

### 2. **Shared S3 Cache**
- All customers share the same S3 bucket
- Cache invalidation affects everyone
- No customer-specific optimization

### 3. **Synchronous Data Source Execution**
- No async processing for heavy operations
- Blocking operations hold database connections
- No background job processing for data updates

### 4. **Limited CDN Optimization**
- Basic caching headers without intelligent invalidation
- No edge-side includes for dynamic content
- No geographic distribution optimization

## Performance Impact by App Type

### **High-Traffic Websites**
- **E-commerce sites**: Product catalogs, inventory, pricing
- **Content sites**: CMS queries, user-generated content
- **SaaS applications**: User data, real-time features

**Bottlenecks**:
- Data source execution under load
- Database connection pool exhaustion
- Cache invalidation cascades

### **Low-Traffic Applications**
- **Marketing sites**: Static content with occasional updates
- **Portfolios**: Image galleries, project showcases
- **Documentation**: Text-heavy content with search

**Bottlenecks**:
- Cache miss performance (less critical)
- Bundle size optimization
- CDN distribution efficiency

## Recommended Mitigation Strategies

### **Short-term (Immediate)**
1. **Increase connection pool sizes** for published app traffic
2. **Implement request queuing** for data source execution
3. **Add timeout handling** for external API calls
4. **Optimize prefill process** reliability

### **Medium-term (3-6 months)**
1. **Implement read replicas** for published app queries
2. **Add customer-specific caching** strategies
3. **Implement async data source processing**
4. **Add CDN optimization** for different app types

### **Long-term (6+ months)**
1. **Consider customer-specific infrastructure** for high-traffic apps
2. **Implement edge computing** for data source execution
3. **Add intelligent cache warming** based on usage patterns
4. **Implement geographic distribution** for global apps

## Monitoring and Alerting

### **Critical Metrics**
- Database connection pool utilization
- S3 cache hit/miss ratios
- Data source execution times
- CDN cache invalidation frequency

### **Alerting Thresholds**
- Connection pool utilization > 80%
- Cache miss ratio > 20%
- Data source execution time > 5 seconds
- Prefill process failures > 5%

## Conclusion

Published Plasmic apps face unique scaling challenges that differ from the studio environment. The primary bottlenecks stem from shared infrastructure (database, S3, CDN) and synchronous processing models. While the current architecture works for moderate scale, it will face significant challenges as the number of published apps and their traffic increases.

Key areas requiring immediate attention:
1. **Database connection management** for published app traffic
2. **Cache invalidation strategies** to prevent cascading failures
3. **Data source execution optimization** for high-traffic scenarios
4. **Infrastructure separation** between studio and published app operations

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Focus**: Published App Runtime Performance
