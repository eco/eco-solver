import { ConfigurationType } from '@/dynamic-config/enums/configuration-type.enum'
import { Document, Schema as MongooseSchema } from 'mongoose'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

export type ConfigurationDocument = Configuration & Document

@Schema({
  timestamps: true,
  collection: 'configurations',
})
export class Configuration {
  @Prop({
    required: true,
    unique: true,
    index: true,
    type: String,
    trim: true,
  })
  key: string

  @Prop({
    required: true,
    type: MongooseSchema.Types.Mixed,
  })
  value: any

  @Prop({
    required: true,
    type: String,
    enum: Object.values(ConfigurationType),
  })
  type: ConfigurationType

  @Prop({
    default: false,
    type: Boolean,
  })
  isRequired: boolean

  @Prop({
    type: String,
    trim: true,
  })
  description?: string

  @Prop({
    type: String,
    trim: true,
  })
  lastModifiedBy?: string

  @Prop({
    default: Date.now,
    type: Date,
  })
  createdAt: Date

  @Prop({
    default: Date.now,
    type: Date,
  })
  updatedAt: Date
}

export const ConfigurationSchema = SchemaFactory.createForClass(Configuration)

// Add compound indexes for better query performance
ConfigurationSchema.index({ key: 1, isRequired: 1 })
ConfigurationSchema.index({ lastModifiedBy: 1, updatedAt: -1 })

// Add validation middleware
ConfigurationSchema.pre('save', function (next) {
  // Validate key format (alphanumeric, dots, underscores, hyphens)
  const keyRegex = /^[a-zA-Z0-9._-]+$/
  if (!keyRegex.test(this.key)) {
    const error = new Error(
      'Configuration key must contain only alphanumeric characters, dots, underscores, and hyphens',
    )
    return next(error)
  }

  // Validate value type matches declared type
  const actualType = Array.isArray(this.value) ? 'array' : typeof this.value
  if (
    actualType !== this.type &&
    !(this.type === 'object' && actualType === 'object' && !Array.isArray(this.value))
  ) {
    const error = new Error(
      `Configuration value type '${actualType}' does not match declared type '${this.type}'`,
    )
    return next(error)
  }

  next()
})

ConfigurationSchema.methods.toSafeJSON = function () {
  const obj = this.toObject()
  return obj
}
