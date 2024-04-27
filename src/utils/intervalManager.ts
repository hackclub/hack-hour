/**
 * Manages intervals
 */
export class IntervalManager {
    private interval: number;
    private callbacks: (() => void)[] = [];    
    private delay: number = 0;
    
    public constructor(interval: number) {
        this.interval = interval;
    }

    public attach(callback: () => Promise<void>): void {
        this.callbacks.push(callback);
    }

    public start(): void {
        setTimeout(() => {
            setInterval(async () => {
                this.callbacks.forEach(async callback => await callback());
            }, this.interval);
        }, this.delay);
    }

    public setDelay(delay: number): void {
        this.delay = delay;
    }
}