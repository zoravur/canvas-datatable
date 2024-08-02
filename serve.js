const { serve } = require('esbuild-serve')

serve({
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'dist/bundle.js',
  servedir: '.',
}, {
  port: 8000,
  live: true,
})
