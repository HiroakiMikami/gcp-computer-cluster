import { Cluster } from "./cluster";

export class Command {
    constructor(private cluster: Cluster) { }
    public async create(withoutSharedComponents = false): Promise<void> {
        if (!withoutSharedComponents) {
            await this.cluster.createSharedComponents()
        }
        await this.cluster.create()
        return
    }
    public async delete(withoutSharedComponents = false): Promise<void> {
        await this.cluster.delete()
        if (!withoutSharedComponents) {
          await this.cluster.deleteSharedComponents()
        }
        return
    }
    public async activate(): Promise<void> {
        await this.cluster.activate()
        return
    }
    public async deactivate(): Promise<void> {
        await this.cluster.deactivate()
        return
    }
}
