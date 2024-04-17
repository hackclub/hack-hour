export function format(template, data) {
    return template.replace(/\${(.*?)}/g, (_, key) => data[key]);
}
export function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
export function formatHour(minutes) {
    if (!minutes) {
        return '0.0';
    }
    const hours = minutes / 60;
    return hours.toFixed(1);
}
