export type ExtensionArgs = {
    slackId?: string,
    sessionTs?: string,
}

export type Extension = {
    onStart: ((args: ExtensionArgs) => void) | null,
    onError: ((args: ExtensionArgs) => void) | null,    
    userCreated: ((args: ExtensionArgs) => void) | null,
    sessionStarted: ((args: ExtensionArgs) => void) | null,
    sessionCancelled: ((args: ExtensionArgs) => void) | null,
    sessionCompleted: ((args: ExtensionArgs) => void) | null,
}

export type ExtensionFunc = keyof Extension;

class ExtensionsManagerInner {
    private extensions: Extension[] = [];

    public attach(extension: Extension): void {
        this.extensions.push(extension);
    }

    public getExtensions(): Extension[] {
        return this.extensions;
    }
}

export const ExtensionsManager = new Proxy(new ExtensionsManagerInner(), 
{
    get: function(target, prop, receiver) {
        return target.getExtensions();
    }
});
