declare module "*.json" {
  const value: any;
  export default value;
  export * from value;
} 