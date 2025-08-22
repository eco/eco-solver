export interface IntentDataDecoder {
    decodeCreateIntentLog(data: string, topics: string[]): any;
}
