import { Enumify } from 'enumify'
import { v4 as uuidv4 } from 'uuid'
import { v5 as uuidv5 } from 'uuid'
import { validate as uuidValidate } from 'uuid'

export class EcoDbEntity extends Enumify {
  static REBALANCE_JOB = new EcoDbEntity('rebalance')
  static REBALANCE_JOB_GROUP = new EcoDbEntity('rebalancegroup')
  static _ = EcoDbEntity.closeEnum()

  constructor(private idNamespace: string) {
    super()
  }

  getEntityID(): string {
    return this.getEntityIDForUUID(uuidv4())
  }

  getEntityIDForUUID(uuidStr: string): string {
    return `${this.idNamespace}:${uuidStr}`
  }

  getEntityIDFromExternalID(externalID: string): string {
    return this.getEntityIDForUUID(uuidv5(externalID, uuidv5.URL))
  }

  static splitEntity(entityID: string): [string, string] {
    const [prefix, value] = entityID.split(':')
    return [prefix, value]
  }

  static hasEntityPrefix(entityID: string, entity: EcoDbEntity): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const [prefix, value] = EcoDbEntity.splitEntity(entityID)
    return prefix === entity.idNamespace
  }

  static isEntityOfType(entityID: string, entity: EcoDbEntity): boolean {
    const [prefix, value] = EcoDbEntity.splitEntity(entityID)
    return prefix === entity.idNamespace && uuidValidate(value)
  }

  static isUUID(value: string): boolean {
    return Boolean(value && uuidValidate(value))
  }

  static getPrefixedRawUUID(prefix: string): string {
    return `${prefix}:${uuidv4()}`
  }

  static getRawUUID(): string {
    return uuidv4()
  }

  static getIdempotentID(): string {
    return uuidv4()
  }
}
