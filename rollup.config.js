import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: ['module/talesoftheoldwest.mjs'],
  output: {
    dir: 'dist/module',
    format: 'es',
    sourcemap: true,
  },
  external: [],
  preserveEntrySignatures: false,
  plugins: [
    nodeResolve(),
    commonjs({
      include: 'node_modules/**',
    }),
  ],
};
