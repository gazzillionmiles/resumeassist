/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: false,
  serverExternalPackages: [
    'pg',
    'pdf-parse',
    'mammoth',
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-s3',
  ],
};
export default nextConfig;
