export function assertVal<T>(value: T | undefined | null): asserts value is T {
    // Throw if the value is undefined
    if (value === undefined) { throw new Error(`${value} is undefined, needs to be type ${typeof value}`) }
    else if (value === null) { throw new Error(`${value} is null, needs to be type ${typeof value}`) }
}