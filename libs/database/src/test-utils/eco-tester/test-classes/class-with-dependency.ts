@Injectable()
export class ClassWithDependency {
  constructor(private readonly simpleDependency: SimpleClass) {}
  public doThing(param1: string): string {
    return param1 + this.simpleDependency.doThing(param1)
  }
}
