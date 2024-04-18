export type Extension = {
    onStart: (() => void) | null,
    onError: (() => void) | null,
    userCreated: ((slackId: string) => void) | null,
    sessionStarted: ((sessionTs: string) => void) | null,
    sessionCancelled: ((sessionTs: string) => void) | null,
    sessionCompleted: ((sessionTs: string) => void) | null,
}

export type ExtensionFunc = keyof Extension;
type ExtensionReturn = Parameters<NonNullable<Extension[ExtensionFunc]>>;

class ExtensionsManagerInner {
    private extensions: Extension[] = [];    

    public constructor() {
        this.extensions = [];
    }

    public attach(extension: Extension): void {
        this.extensions.push(extension);
    }

    public getExtensions(): Extension[] {
        return this.extensions;
    }

    public getExtensionFunc(func: ExtensionFunc): Function[] {
        return this.extensions.map((extension) => extension[func] as Function).filter((func) => func !== null);
    }

    public execute(func: ExtensionFunc, ...args: any[]): void {
        this.getExtensionFunc(func).forEach((func) => {
            console.log(`[Executing...] ${func.name}`);
            func(...args)
        });
        console.log(`[Completed Executed] ${func}`);
    }

    onStart = (): void => {};
    onError = (): void => {} 
    userCreated = (slackId: string): void => {}
    sessionStarted = (sessionTs: string): void => {}
    sessionCancelled = (sessionTs: string): void => {}
    sessionCompleted = (sessionTs: string): void => {}
}

export const ExtensionsManager = () => {
    return new Proxy(new ExtensionsManagerInner(), {
        get(target, prop) {
            let data: string;
            if (typeof prop === 'symbol') {
                data = prop.description as string;
            } else {
                data = prop as string;
            }

            if (!(data in target)) {
                throw new Error(`Property ${data} does not exist in ExtensionsManager`);
            }

            if (['attach', 'getExtensions', 'getExtensionFunc', 'execute', 'extensions'].includes(data)) {
                return target[data as keyof ExtensionsManagerInner];
            }

            return (...args: ExtensionReturn): void => {
                target.execute(prop as ExtensionFunc, ...args);
            };
        }
    });
}