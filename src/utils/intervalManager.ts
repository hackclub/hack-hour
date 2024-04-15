/**
 * Manages intervals
 */
export class IntervalManager {
    private interval: number;
    private callbacks: (() => void)[] = [];    
    
    public constructor(interval: number) {
        this.interval = interval;
    }

    public attach(callback: () => void): void {
        this.callbacks.push(callback);
    }

    public start(): void {
        setInterval(() => {
            this.callbacks.forEach(callback => callback());
        }, this.interval);
    }
}