import { AuditOperation } from '@/modules/dynamic-config/enums/audit-operation.enum';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ConfigurationAuditDocument = ConfigurationAudit & Document;

@Schema({
  timestamps: true,
  collection: 'configuration_audits',
})
export class ConfigurationAudit {
  @Prop({
    required: true,
    index: true,
    type: String,
    trim: true,
  })
  configKey: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(AuditOperation),
  })
  operation: AuditOperation;

  @Prop({
    type: MongooseSchema.Types.Mixed,
  })
  oldValue?: any;

  @Prop({
    type: MongooseSchema.Types.Mixed,
  })
  newValue?: any;

  @Prop({
    required: true,
    type: String,
    trim: true,
  })
  userId: string;

  @Prop({
    type: String,
    trim: true,
  })
  userAgent?: string;

  @Prop({
    default: Date.now,
    type: Date,
    index: true,
  })
  timestamp: Date;

  @Prop({
    default: Date.now,
    type: Date,
  })
  createdAt: Date;

  @Prop({
    default: Date.now,
    type: Date,
  })
  updatedAt: Date;
}

export const ConfigurationAuditSchema = SchemaFactory.createForClass(ConfigurationAudit);

// Add compound indexes for efficient querying
ConfigurationAuditSchema.index({ configKey: 1, timestamp: -1 });
ConfigurationAuditSchema.index({ userId: 1, timestamp: -1 });
ConfigurationAuditSchema.index({ operation: 1, timestamp: -1 });
ConfigurationAuditSchema.index({ timestamp: -1 }); // For cleanup operations

// Add TTL index for automatic cleanup of old audit logs (optional - can be configured)
// Uncomment and adjust the expiration time as needed
// ConfigurationAuditSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }) // 1 year

// Add validation middleware
ConfigurationAuditSchema.pre('save', function (next) {
  // Ensure we have either oldValue or newValue for UPDATE operations
  if (this.operation === 'UPDATE' && !this.oldValue && !this.newValue) {
    const error = new Error('UPDATE operations must have either oldValue or newValue');
    return next(error);
  }

  // Ensure we have newValue for CREATE operations
  if (this.operation === 'CREATE' && !this.newValue) {
    const error = new Error('CREATE operations must have newValue');
    return next(error);
  }

  // Ensure we have oldValue for DELETE operations
  if (this.operation === 'DELETE' && !this.oldValue) {
    const error = new Error('DELETE operations must have oldValue');
    return next(error);
  }

  next();
});

ConfigurationAuditSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  return obj;
};
