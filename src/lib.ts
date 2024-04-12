export function format(template: string, data: { [key: string]: string }) {
    return template.replace(/\${(.*?)}/g, (_, key) => data[key])
}

export function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}