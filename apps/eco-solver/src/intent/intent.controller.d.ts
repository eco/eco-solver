import { WatchCreateIntentService } from '../watch/intent/watch-create-intent.service';
import { ValidateIntentService } from './validate-intent.service';
export declare class IntentSourceController {
    private readonly watchIntentService;
    private readonly validateService;
    private logger;
    constructor(watchIntentService: WatchCreateIntentService, validateService: ValidateIntentService);
    fakeIntent(): Promise<void>;
    fakeProcess(): Promise<boolean>;
}
