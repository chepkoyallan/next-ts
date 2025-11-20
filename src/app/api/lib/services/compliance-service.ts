// Enterprise compliance and governance service
import { logger } from '../utils/logger';
import { FeatureContext } from './feature-gate-service';
import { AuditLog, ComplianceFeatures } from '../types/billing';

export interface ComplianceConfig {
  enabled: boolean;
  features: ComplianceFeatures;
  retentionPeriods: {
    auditLogs: number; // days
    executionLogs: number;
    userData: number;
  };
  encryptionKeys: {
    dataAtRest: string;
    dataInTransit: string;
  };
}

export interface DataClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted';
  categories: string[];
  piiDetected: boolean;
  sensitiveFields: string[];
  retentionPolicy: string;
}

export interface ComplianceReport {
  id: string;
  type: 'audit' | 'privacy' | 'security' | 'retention';
  period: {
    start: Date;
    end: Date;
  };
  findings: ComplianceFinding[];
  recommendations: ComplianceRecommendation[];
  status: 'compliant' | 'non_compliant' | 'needs_review';
  generatedAt: Date;
  generatedBy: string;
}

export interface ComplianceFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  evidence: Record<string, any>[];
  remediation: string;
  dueDate?: Date;
}

export interface ComplianceRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  implementation: string;
  estimatedEffort: string;
  complianceFrameworks: string[];
}

export class ComplianceService {
  private db: any;

  private config: ComplianceConfig;

  private encryptionService: any;

  constructor(db: any, config: ComplianceConfig, encryptionService: any) {
    this.db = db;
    this.config = config;
    this.encryptionService = encryptionService;
  }

  // ============================================================================
  // AUDIT LOGGING
  // ============================================================================

  async logAuditEvent(event: Partial<AuditLog>): Promise<void> {
    if (!this.config.features.auditLogging) return;

    try {
      const auditLog: AuditLog = {
        id: ComplianceService.generateId(),
        userId: event.userId!,
        projectId: event.projectId!,
        action: event.action!,
        resource: event.resource!,
        resourceId: event.resourceId!,
        timestamp: new Date(),
        ipAddress: event.ipAddress!,
        userAgent: event.userAgent!,
        metadata: event.metadata || {},
      };

      // Encrypt sensitive data if required
      if (this.config.features.encryptionAtRest) {
        auditLog.metadata = await this.encryptionService.encrypt(
          JSON.stringify(auditLog.metadata),
          this.config.encryptionKeys.dataAtRest
        );
      }

      await this.db.auditLogs.create(auditLog);

      logger.debug('Audit event logged', {
        action: auditLog.action,
        resource: auditLog.resource,
        userId: auditLog.userId,
      });
    } catch (error) {
      logger.error('Failed to log audit event', error as Error);
    }
  }

  async getAuditLogs(filters: {
    userId?: string;
    projectId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      const logs = await this.db.auditLogs.find(filters);
      const total = await this.db.auditLogs.count(filters);

      // Decrypt metadata if encrypted
      if (this.config.features.encryptionAtRest) {
        await Promise.all(
          logs.map(async (log: AuditLog) => {
            if (typeof log.metadata === 'string') {
              try {
                log.metadata = JSON.parse(
                  await this.encryptionService.decrypt(
                    log.metadata,
                    this.config.encryptionKeys.dataAtRest
                  )
                );
              } catch {
                logger.warn('Failed to decrypt log metadata', { logId: log.id });
                log.metadata = {};
              }
            }
            return log;
          })
        );
      }

      return { logs, total };
    } catch (error) {
      logger.error('Failed to get audit logs', error as Error);
      return { logs: [], total: 0 };
    }
  }

  // ============================================================================
  // DATA CLASSIFICATION & PII DETECTION
  // ============================================================================

  async classifyData(
    data: Record<string, any>,
    context: FeatureContext
  ): Promise<DataClassification> {
    if (!this.config.features.dataClassification) {
      return {
        level: 'internal',
        categories: [],
        piiDetected: false,
        sensitiveFields: [],
        retentionPolicy: 'standard',
      };
    }

    try {
      const classification: DataClassification = {
        level: 'internal',
        categories: [],
        piiDetected: false,
        sensitiveFields: [],
        retentionPolicy: 'standard',
      };

      // Detect PII patterns
      const piiPatterns = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
        phone: /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/g,
        ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      };

      const dataString = JSON.stringify(data);

      Object.entries(piiPatterns).map(([type, pattern]: [string, RegExp]) => {
        if (pattern.test(dataString)) {
          classification.piiDetected = true;
          classification.sensitiveFields.push(type);
          classification.categories.push(`pii_${type}`);
        }
        return null;
      });

      // Classify based on content
      if (classification.piiDetected) {
        classification.level = 'confidential';
        classification.retentionPolicy = 'pii_retention';
      }

      // Check for financial data
      if (dataString.includes('payment') || dataString.includes('billing')) {
        classification.categories.push('financial');
        classification.level = 'restricted';
      }

      // Check for health data
      if (dataString.includes('health') || dataString.includes('medical')) {
        classification.categories.push('health');
        classification.level = 'restricted';
      }

      // Log classification for audit
      await this.logAuditEvent({
        userId: context.userId,
        projectId: context.projectId,
        action: 'data_classified',
        resource: 'data',
        resourceId: 'classification',
        ipAddress: '127.0.0.1',
        userAgent: 'system',
        metadata: {
          classification,
          dataSize: dataString.length,
        },
      });

      return classification;
    } catch (error) {
      logger.error('Failed to classify data', error as Error);
      return {
        level: 'internal',
        categories: [],
        piiDetected: false,
        sensitiveFields: [],
        retentionPolicy: 'standard',
      };
    }
  }

  // ============================================================================
  // DATA RETENTION & DELETION
  // ============================================================================

  async enforceRetentionPolicies(): Promise<void> {
    if (!this.config.features.retentionPolicies) return;

    try {
      const now = new Date();

      // Clean up audit logs
      const auditCutoff = new Date(
        now.getTime() - this.config.retentionPeriods.auditLogs * 24 * 60 * 60 * 1000
      );
      await this.db.auditLogs.deleteOlderThan(auditCutoff);

      // Clean up execution logs
      const executionCutoff = new Date(
        now.getTime() - this.config.retentionPeriods.executionLogs * 24 * 60 * 60 * 1000
      );
      await this.db.executionLogs.deleteOlderThan(executionCutoff);

      // Handle user data retention (more complex, requires careful handling)
      await ComplianceService.handleUserDataRetention();

      logger.info('Retention policies enforced', {
        auditCutoff,
        executionCutoff,
      });
    } catch (error) {
      logger.error('Failed to enforce retention policies', error as Error);
    }
  }

  async requestDataDeletion(userId: string, reason: string): Promise<string> {
    try {
      const deletionRequestId = ComplianceService.generateId();

      // Create deletion request
      await this.db.dataDeletionRequests.create({
        id: deletionRequestId,
        userId,
        reason,
        status: 'pending',
        requestedAt: new Date(),
        scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Log the request
      await this.logAuditEvent({
        userId,
        projectId: 'system',
        action: 'data_deletion_requested',
        resource: 'user_data',
        resourceId: userId,
        ipAddress: '127.0.0.1',
        userAgent: 'system',
        metadata: { reason, deletionRequestId },
      });

      logger.info('Data deletion requested', { userId, deletionRequestId });
      return deletionRequestId;
    } catch (error) {
      logger.error('Failed to request data deletion', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // COMPLIANCE REPORTING
  // ============================================================================

  async generateComplianceReport(
    type: 'audit' | 'privacy' | 'security' | 'retention',
    period: { start: Date; end: Date },
    generatedBy: string
  ): Promise<ComplianceReport> {
    try {
      const report: ComplianceReport = {
        id: ComplianceService.generateId(),
        type,
        period,
        findings: [],
        recommendations: [],
        status: 'compliant',
        generatedAt: new Date(),
        generatedBy,
      };

      switch (type) {
        case 'audit':
          report.findings = await this.generateAuditFindings(period);
          break;
        case 'privacy':
          report.findings = await this.generatePrivacyFindings(period);
          break;
        case 'security':
          report.findings = await this.generateSecurityFindings(period);
          break;
        case 'retention':
          report.findings = await this.generateRetentionFindings(period);
          break;
        default:
          report.findings = [];
          break;
      }

      // Generate recommendations based on findings
      report.recommendations = await ComplianceService.generateRecommendations(report.findings);

      // Determine overall status
      const criticalFindings = report.findings.filter((f) => f.severity === 'critical');
      const highFindings = report.findings.filter((f) => f.severity === 'high');

      if (criticalFindings.length > 0) {
        report.status = 'non_compliant';
      } else if (highFindings.length > 0) {
        report.status = 'needs_review';
      }

      // Store report
      await this.db.complianceReports.create(report);

      logger.info('Compliance report generated', {
        reportId: report.id,
        type,
        findingsCount: report.findings.length,
        status: report.status,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report', error as Error);
      throw error;
    }
  }
  // ============================================================================
  // GDPR COMPLIANCE
  // ============================================================================

  async handleGDPRRequest(
    type: 'access' | 'rectification' | 'erasure' | 'portability',
    userId: string,
    details: Record<string, any>
  ): Promise<string> {
    try {
      const requestId = ComplianceService.generateId();

      await this.db.gdprRequests.create({
        id: requestId,
        type,
        userId,
        details,
        status: 'pending',
        createdAt: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Log GDPR request
      await this.logAuditEvent({
        userId,
        projectId: 'system',
        action: `gdpr_${type}_requested`,
        resource: 'user_data',
        resourceId: userId,
        ipAddress: '127.0.0.1',
        userAgent: 'system',
        metadata: { requestId, details },
      });

      // Process request based on type
      switch (type) {
        case 'access':
          await ComplianceService.processDataAccessRequest(requestId, userId);
          break;
        case 'erasure':
          await ComplianceService.processDataErasureRequest(requestId, userId);
          break;
        case 'portability':
          await ComplianceService.processDataPortabilityRequest(requestId, userId);
          break;
        default:
          throw new Error(`Unsupported GDPR request type: ${type}`);
      }

      return requestId;
    } catch (error) {
      logger.error('Failed to handle GDPR request', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private static generateId(): string {
    return `comp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private static async handleUserDataRetention(): Promise<void> {
    // Implement user data retention logic
    // This is complex and requires careful handling of user relationships
  }

  private async generateAuditFindings(period: {
    start: Date;
    end: Date;
  }): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check for missing audit logs
    const expectedEvents = await this.db.expectedAuditEvents.countForPeriod(period);
    const actualEvents = await this.db.auditLogs.countForPeriod(period);

    if (actualEvents < expectedEvents * 0.95) {
      findings.push({
        id: ComplianceService.generateId(),
        severity: 'high',
        category: 'audit_completeness',
        description: `Missing audit events detected. Expected: ${expectedEvents}, Actual: ${actualEvents}`,
        evidence: [{ expectedEvents, actualEvents }],
        remediation: 'Review audit logging configuration and ensure all events are captured',
      });
    }

    return findings;
  }

  private async generatePrivacyFindings(period: {
    start: Date;
    end: Date;
  }): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check for unclassified data
    const unclassifiedData = await this.db.dataClassifications.countUnclassified(period);
    if (unclassifiedData > 0) {
      findings.push({
        id: ComplianceService.generateId(),
        severity: 'medium',
        category: 'data_classification',
        description: `${unclassifiedData} data items remain unclassified`,
        evidence: [{ count: unclassifiedData }],
        remediation: 'Implement automated data classification for all new data',
      });
    }

    return findings;
  }

  private async generateSecurityFindings(period: {
    start: Date;
    end: Date;
  }): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check for unencrypted sensitive data
    if (this.config.features.encryptionAtRest) {
      const unencryptedSensitive = await this.db.sensitiveData.countUnencrypted(period);
      if (unencryptedSensitive > 0) {
        findings.push({
          id: ComplianceService.generateId(),
          severity: 'critical',
          category: 'encryption',
          description: `${unencryptedSensitive} sensitive data items are not encrypted`,
          evidence: [{ count: unencryptedSensitive }],
          remediation: 'Encrypt all sensitive data at rest immediately',
        });
      }
    }

    return findings;
  }

  private async generateRetentionFindings(period: {
    start: Date;
    end: Date;
  }): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check for data past retention period
    const expiredData = await this.db.retentionViolations.findExpired(period);
    if (expiredData.length > 0) {
      findings.push({
        id: ComplianceService.generateId(),
        severity: 'high',
        category: 'data_retention',
        description: `${expiredData.length} data items have exceeded retention period`,
        evidence: expiredData,
        remediation: 'Implement automated data deletion for expired data',
      });
    }

    return findings;
  }

  private static async generateRecommendations(
    findings: ComplianceFinding[]
  ): Promise<ComplianceRecommendation[]> {
    const recommendations: ComplianceRecommendation[] = [];

    // Generate recommendations based on findings
    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    if (criticalFindings.length > 0) {
      recommendations.push({
        id: ComplianceService.generateId(),
        priority: 'high',
        title: 'Address Critical Compliance Issues',
        description: 'Critical compliance violations require immediate attention',
        implementation: 'Review and remediate all critical findings within 24 hours',
        estimatedEffort: '1-2 days',
        complianceFrameworks: ['GDPR', 'SOC2', 'HIPAA'],
      });
    }

    return recommendations;
  }

  private static async processDataAccessRequest(requestId: string, userId: string): Promise<void> {
    // Implement data access request processing
    logger.info('Processing data access request', { requestId, userId });
  }

  private static async processDataErasureRequest(requestId: string, userId: string): Promise<void> {
    // Implement data erasure request processing
    logger.info('Processing data erasure request', { requestId, userId });
  }

  private static async processDataPortabilityRequest(
    requestId: string,
    userId: string
  ): Promise<void> {
    // Implement data portability request processing
    logger.info('Processing data portability request', { requestId, userId });
  }
}
