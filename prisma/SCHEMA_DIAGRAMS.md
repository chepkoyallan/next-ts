# Prisma Schema v2.0 - Entity Relationship Diagrams

This document contains Mermaid ER diagrams showing all relationships in the schema.

---

## 1. Authentication & User Management

### Core User Model (Modular Design)

```mermaid
erDiagram
    User ||--o| UserProfile : has
    User ||--o| UserSecurity : has
    User ||--o| UserNotificationSettings : has
    User ||--o{ UserSocialLink : has
    User ||--o{ UserSession : has
    User ||--o{ EmailVerification : has
    User ||--o{ UserRole : has

    UserSecurity ||--o{ TwoFactorBackupCode : has
    UserSecurity ||--o{ TrustedDevice : has
    UserSecurity ||--o| PasswordResetToken : has
    UserSecurity ||--o{ SecurityAuditLog : has

    User {
        string id PK
        string email "UNIQUE"
        string name
        string passwordHash
        boolean emailVerified
        datetime lastLoginAt
        datetime lastLoginIp
        jsonb metadata
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    UserProfile {
        string id PK
        string userId "FK, UNIQUE"
        string photoURL
        string phoneNumber
        string country
        string address
        string state
        string city
        string zipCode
        string about
        boolean isPublic
        string bio
        string website
        string company
        string location
        string timezone
    }

    UserSecurity {
        string id PK
        string userId "FK, UNIQUE"
        boolean twoFactorEnabled
        string twoFactorSecret
        datetime passwordChangedAt
        boolean requirePasswordChange
        int failedLoginAttempts
        datetime accountLockedUntil
        datetime lastFailedLoginAttempt
    }

    TwoFactorBackupCode {
        string id PK
        string userSecurityId FK
        string code "UNIQUE"
        boolean isUsed
        datetime usedAt
        string usedFromIp
    }

    UserSession {
        string id PK
        string userId FK
        string token "UNIQUE"
        string refreshToken "UNIQUE"
        string ipAddress
        string userAgent
        jsonb deviceInfo
        boolean isActive
        datetime lastActivityAt
        datetime expiresAt
        datetime revokedAt
        string revokedReason
    }

    EmailVerification {
        string id PK
        string userId FK
        string email
        string token "UNIQUE"
        datetime expiresAt
        datetime verifiedAt
        string verifiedIp
    }

    UserSocialLink {
        string id PK
        string userId FK
        string platform
        string url
        boolean isPublic
    }

    UserNotificationSettings {
        string id PK
        string userId "FK, UNIQUE"
        boolean emailEnabled
        boolean emailDigest
        string emailDigestFrequency
        boolean productUpdates
        boolean securityAlerts
        boolean billingAlerts
        boolean workflowNotifications
        boolean marketplaceUpdates
        boolean inAppEnabled
        boolean desktopEnabled
        boolean mobileEnabled
        boolean quietHoursEnabled
        string quietHoursStart
        string quietHoursEnd
        string quietHoursTimezone
    }
```

### Role-Based Access Control (RBAC)

```mermaid
erDiagram
    User ||--o{ UserRole : has
    Role ||--o{ UserRole : has
    Role ||--o{ RolePermission : has
    Permission ||--o{ RolePermission : has

    User {
        string id PK
        string email "UNIQUE"
        string name
    }

    Role {
        string id PK
        string name "UNIQUE"
        string description
        boolean isSystem
        datetime deletedAt
    }

    Permission {
        string id PK
        string resource
        string action
        string description
        datetime deletedAt
    }

    UserRole {
        string id PK
        string userId FK
        string roleId FK
        string assignedBy
        datetime assignedAt
        datetime expiresAt
    }

    RolePermission {
        string id PK
        string roleId FK
        string permissionId FK
        jsonb conditions
        datetime createdAt
    }
```

---

## 2. Multi-Tenancy & Organizations

```mermaid
erDiagram
    User ||--o{ Organization : owns
    Organization ||--o{ OrganizationMember : has
    User ||--o{ OrganizationMember : is
    Organization ||--o{ Project : has
    Organization ||--o{ BillingAccount : has
    Organization ||--o{ FeatureUsage : has
    Organization ||--o{ ConnectorConfig : has

    Organization {
        string id PK
        string name
        string slug "UNIQUE"
        string description
        string ownerId FK
        jsonb settings
        datetime deletedAt
        datetime createdAt
        datetime updatedAt
    }

    OrganizationMember {
        string id PK
        string organizationId FK
        string userId FK
        string role
        jsonb permissions
        datetime joinedAt
        datetime leftAt
    }

    Project {
        string id PK
        string name
        string slug
        string description
        string organizationId FK
        string createdBy FK
        jsonb settings
        datetime deletedAt
        datetime createdAt
        datetime updatedAt
    }
```

---

## 3. Workflow Engine

```mermaid
erDiagram
    User ||--o{ Workflow : creates
    Project ||--o{ Workflow : contains
    Workflow ||--o{ LaunchPlan : has
    Workflow ||--o{ WorkflowVersion : has
    Workflow ||--o{ WorkflowDraft : has
    LaunchPlan ||--o{ WorkflowExecution : launches
    WorkflowExecution ||--o{ TaskExecution : contains
    Task ||--o{ TaskExecution : defines

    Workflow {
        string id PK
        string name
        string description
        string projectId FK
        string createdBy FK
        string version
        jsonb definition
        string status
        datetime deletedAt
    }

    LaunchPlan {
        string id PK
        string workflowId FK
        string name
        string createdBy FK
        jsonb configuration
        jsonb schedule
        string status
        datetime deletedAt
    }

    WorkflowExecution {
        string id PK
        string workflowId FK
        string launchPlanId FK
        string projectId FK
        string organizationId FK
        string createdBy FK
        string phase
        datetime startedAt
        datetime completedAt
        jsonb inputs
        jsonb outputs
        jsonb error
    }

    Task {
        string id PK
        string name
        string type
        string createdBy FK
        jsonb configuration
        jsonb inputs
        jsonb outputs
        datetime deletedAt
    }

    TaskExecution {
        string id PK
        string executionId FK
        string taskId FK
        string phase
        int retryAttempt
        datetime startedAt
        datetime completedAt
        jsonb inputs
        jsonb outputs
        jsonb error
    }

    WorkflowDraft {
        string id PK
        string workflowId FK
        string createdBy FK
        string deployedBy FK
        jsonb definition
        string status
        datetime deployedAt
        datetime deletedAt
    }
```

---

## 4. BMaaS (Backend-as-a-Service)

```mermaid
erDiagram
    Organization ||--o{ BmaasInstance : owns
    Organization ||--o{ BmaasVolume : owns
    Organization ||--o{ BmaasNetwork : owns
    Organization ||--o{ BmaasBucket : owns
    User ||--o{ BmaasInstance : creates
    User ||--o{ BmaasVolume : creates
    User ||--o{ BmaasNetwork : creates
    User ||--o{ BmaasBucket : creates
    BmaasInstance ||--o{ BmaasVolume : attaches
    BmaasInstance ||--o{ BmaasNetwork : connects

    BmaasInstance {
        string id PK
        string name
        string organizationId FK
        string createdBy FK
        string type
        string status
        jsonb configuration
        jsonb resources
        string ipAddress
        datetime deletedAt
    }

    BmaasVolume {
        string id PK
        string name
        string organizationId FK
        string createdBy FK
        string instanceId FK
        int sizeGB
        string status
        string volumeType
        datetime deletedAt
    }

    BmaasNetwork {
        string id PK
        string name
        string organizationId FK
        string createdBy FK
        string cidr
        string status
        jsonb configuration
        datetime deletedAt
    }

    BmaasBucket {
        string id PK
        string name "UNIQUE"
        string organizationId FK
        string createdBy FK
        string region
        string status
        boolean isPublic
        jsonb configuration
        datetime deletedAt
    }
```

---

## 5. Billing & Usage

```mermaid
erDiagram
    Organization ||--o{ BillingAccount : has
    BillingAccount ||--o{ Invoice : generates
    BillingAccount ||--o{ PaymentMethod : has
    Invoice ||--o{ InvoiceItem : contains
    Project ||--o{ ExecutionUsage : tracks
    User ||--o{ ExecutionUsage : creates

    BillingAccount {
        string id PK
        string organizationId FK
        string customerId
        string status
        jsonb billingDetails
        datetime createdAt
        datetime updatedAt
    }

    Invoice {
        string id PK
        string billingAccountId FK
        string invoiceNumber "UNIQUE"
        decimal amount
        string currency
        string status
        datetime dueDate
        datetime paidAt
        jsonb metadata
    }

    InvoiceItem {
        string id PK
        string invoiceId FK
        string description
        decimal quantity
        decimal unitPrice
        decimal amount
        jsonb metadata
    }

    PaymentMethod {
        string id PK
        string billingAccountId FK
        string type
        jsonb details
        boolean isDefault
        datetime expiresAt
    }

    ExecutionUsage {
        string id PK
        string userId FK
        string projectId FK
        string executionId
        string workflowId
        string status
        int durationSeconds
        decimal cost
        datetime startTime
        datetime endTime
    }
```

---

## 6. Marketplace & Features

```mermaid
erDiagram
    MarketplaceWorkflow ||--o{ MarketplaceVersion : has
    MarketplaceWorkflow ||--o{ MarketplaceReview : receives
    User ||--o{ MarketplaceReview : writes
    User ||--o{ MarketplaceInstallation : installs
    MarketplaceWorkflow ||--o{ MarketplaceInstallation : installed
    Organization ||--o{ FeatureUsage : tracks
    FeatureGate ||--o{ FeatureUsage : controls

    MarketplaceWorkflow {
        string id PK
        string name "UNIQUE"
        string description
        string publisherId FK
        string category
        decimal price
        string status
        int downloadCount
        decimal rating
    }

    MarketplaceVersion {
        string id PK
        string workflowId FK
        string version "UNIQUE"
        jsonb definition
        string changelog
        datetime publishedAt
    }

    MarketplaceReview {
        string id PK
        string workflowId FK
        string userId FK
        int rating
        string comment
        datetime createdAt
    }

    MarketplaceInstallation {
        string id PK
        string workflowId FK
        string userId FK
        string organizationId FK
        string versionInstalled
        datetime installedAt
        datetime lastUsedAt
    }

    FeatureGate {
        string id PK
        string feature "UNIQUE"
        boolean isActive
        jsonb configuration
        datetime deletedAt
    }

    FeatureUsage {
        string id PK
        string organizationId FK
        string feature
        int usageCount
        datetime lastUsedAt
        jsonb metadata
    }
```

---

## 7. Connectors & Integrations

```mermaid
erDiagram
    Organization ||--o{ ConnectorConfig : owns
    User ||--o{ ConnectorConfig : creates
    ConnectorConfig ||--o{ ConnectorAuditLog : generates
    MappingTemplate ||--o{ ConnectorConfig : templates

    ConnectorConfig {
        string id PK
        string name
        string description
        string organizationId FK
        string createdBy FK
        string type
        jsonb configuration
        jsonb authentication
        jsonb schema
        jsonb dataMapping
        jsonb caching
        jsonb rateLimit
        string status
        datetime lastHealthCheck
        string healthStatus
        int totalExecutions
        int successfulExecutions
        int failedExecutions
        float averageResponseTime
        stringArray tags
        string category
        datetime deletedAt
    }

    ConnectorAuditLog {
        string id PK
        string connectorId FK
        string action
        string userId
        string organizationId
        jsonb queryParams
        jsonb result
        jsonb changes
        jsonb metadata
        datetime timestamp
    }

    MappingTemplate {
        string id PK
        string name
        string provider
        string category
        string service
        string connectorType
        string rootPath
        jsonb mappings
        string valueField
        string displayField
        jsonb searchFields
        jsonb sampleData
        int usageCount
        decimal rating
        int reviewCount
        string status
        string visibility
        string organizationId
        stringArray tags
        string icon
        string logoUrl
        string documentation
        jsonb setupInstructions
        boolean isSystemTemplate
        boolean isFeatured
    }
```

---

## 8. API Management & Webhooks

```mermaid
erDiagram
    User ||--o{ ApiKey : owns
    ApiKey ||--o{ ApiUsageLog : generates
    ApiKey ||--o{ ApiRateLimit : has
    Organization ||--o{ Webhook : configures
    Webhook ||--o{ WebhookDelivery : sends

    ApiKey {
        string id PK
        string userId FK
        string name
        string keyHash "UNIQUE"
        string keyPrefix
        stringArray permissions
        boolean isActive
        datetime expiresAt
        datetime lastUsedAt
        string rateLimitTier
        datetime createdAt
    }

    ApiUsageLog {
        string id PK
        string apiKeyId FK
        string endpoint
        string method
        int statusCode
        string ipAddress
        int duration
        jsonb requestBody
        jsonb responseBody
        datetime timestamp
    }

    ApiRateLimit {
        string id PK
        string apiKeyId FK
        string limitType
        string resource
        int maxRequests
        int windowMs
        int currentCount
        datetime windowStart
        datetime createdAt
    }

    Webhook {
        string id PK
        string organizationId FK
        string url
        string secret
        stringArray events
        boolean isActive
        jsonb retryPolicy
        datetime createdAt
        datetime updatedAt
    }

    WebhookDelivery {
        string id PK
        string webhookId FK
        string event
        jsonb payload
        int statusCode
        string response
        boolean isSuccessful
        int attempt
        datetime deliveredAt
        datetime createdAt
    }
```

---

## 9. Notification System

```mermaid
erDiagram
    User ||--o{ Notification : receives
    Notification ||--o{ NotificationDelivery : delivers
    User ||--o{ NotificationPreference : configures
    NotificationTemplate ||--o{ Notification : templates

    NotificationTemplate {
        string id PK
        string key "UNIQUE"
        string titleTemplate
        string bodyTemplate
        string emailTemplate
        NotificationCategory category
        NotificationSeverity severity
        stringArray defaultChannels
        jsonb variables
        datetime createdAt
        datetime updatedAt
    }

    Notification {
        string id PK
        string userId FK
        string title
        string body
        NotificationCategory category
        NotificationSeverity severity
        boolean isRead
        boolean isDismissed
        datetime readAt
        datetime dismissedAt
        jsonb data
        string link
        datetime createdAt
    }

    NotificationDelivery {
        string id PK
        string notificationId FK
        NotificationChannel channel
        string recipient
        NotificationDeliveryStatus status
        datetime sentAt
        datetime deliveredAt
        datetime failedAt
        string errorMessage
        jsonb metadata
    }

    NotificationPreference {
        string id PK
        string userId FK
        NotificationCategory category
        stringArray channels
        boolean enabled
        jsonb customSettings
        datetime createdAt
        datetime updatedAt
    }
```

---

## 10. Audit & Monitoring

```mermaid
erDiagram
    Organization ||--o{ AuditLog : generates
    User ||--o{ AuditLog : creates
    Organization ||--o{ Metric : tracks
    Organization ||--o{ Alert : receives
    Metric ||--o{ Alert : triggers

    AuditLog {
        string id PK
        string organizationId FK
        string userId FK
        string action
        string resource
        string resourceId
        jsonb changes
        jsonb metadata
        string ipAddress
        string userAgent
        datetime timestamp
    }

    Metric {
        string id PK
        string name
        string organizationId FK
        string type
        decimal value
        jsonb labels
        datetime timestamp
    }

    Alert {
        string id PK
        string organizationId FK
        string name
        string condition
        string severity
        string status
        jsonb configuration
        datetime triggeredAt
        datetime resolvedAt
        datetime createdAt
    }
```

---

## 11. Forms & Dynamic Schemas

```mermaid
erDiagram
    Organization ||--o{ FormSchema : owns
    FormSchema ||--o{ FormSubmission : receives

    FormSchema {
        string id PK
        string organizationId FK
        string name
        string description
        jsonb schema
        jsonb uiSchema
        jsonb validation
        boolean isPublic
        string status
        datetime createdAt
        datetime updatedAt
    }

    FormSubmission {
        string id PK
        string formSchemaId FK
        string submittedBy
        jsonb data
        string status
        jsonb metadata
        datetime submittedAt
    }
```

---

## 12. Configuration Management

```mermaid
erDiagram
    Organization ||--o{ ConfigEntry : owns

    ConfigEntry {
        string id PK
        string key "UNIQUE"
        string value
        string type
        string organizationId FK
        boolean isEncrypted
        boolean isPublic
        string description
        datetime createdAt
        datetime updatedAt
    }
```

---

## Complete System Overview

```mermaid
erDiagram
    %% Core Entities
    User ||--o{ Organization : owns
    User ||--o{ Project : creates
    User ||--o{ Workflow : creates
    User ||--o{ WorkflowExecution : initiates

    Organization ||--o{ Project : contains
    Organization ||--o{ BillingAccount : has
    Organization ||--o{ BmaasInstance : provisions
    Organization ||--o{ ConnectorConfig : configures

    Project ||--o{ Workflow : contains
    Workflow ||--o{ LaunchPlan : has
    Workflow ||--o{ WorkflowExecution : executes

    %% Supporting Services
    Organization ||--o{ Webhook : configures
    User ||--o{ ApiKey : manages
    User ||--o{ Notification : receives
    User ||--o{ UserSession : maintains

    %% Billing & Usage
    Project ||--o{ ExecutionUsage : tracks
    BillingAccount ||--o{ Invoice : generates

    %% Marketplace
    User ||--o{ MarketplaceInstallation : installs
    Organization ||--o{ FeatureUsage : tracks
```

---

## Key Relationships Summary

### One-to-One (||--o|)
- User ↔ UserProfile
- User ↔ UserSecurity
- User ↔ UserNotificationSettings
- UserSecurity ↔ PasswordResetToken

### One-to-Many (||--o{)
- User → UserSessions
- User → Organizations (owned)
- User → Projects (created)
- User → Workflows (created)
- User → Notifications
- User → ApiKeys
- Organization → Projects
- Organization → BillingAccounts
- Organization → Members
- Organization → BMaaS Resources
- Workflow → LaunchPlans
- Workflow → WorkflowExecutions
- BillingAccount → Invoices
- Invoice → InvoiceItems

### Many-to-Many (via join tables)
- User ↔ Role (via UserRole)
- Role ↔ Permission (via RolePermission)
- Organization ↔ User (via OrganizationMember)

---

## Database Constraints

### Foreign Keys
- All FK relations use `onDelete: Cascade` for dependent data
- Creator relations use `onDelete: Restrict` to preserve audit trail
- Soft deletes via `deletedAt` timestamp for audit compliance

### Unique Constraints
- Composite unique: `[userId, platform]` on UserSocialLink
- Composite unique: `[provider, service, connectorType]` on MappingTemplate
- Single column unique: email, token fields, codes, slugs

### Indexes
- All FK columns indexed
- Composite indexes on common query patterns
- Status fields indexed for filtering
- Timestamp fields indexed for range queries
- Full-text search indexes where applicable

---

*Generated: November 20, 2025*
*Schema Version: v2.0*
*Total Models: 90*
*Total Relations: 150+*
