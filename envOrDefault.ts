export default function envOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}
