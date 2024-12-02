import { defineConfig } from 'vite'
import commonjs from 'vite-plugin-commonjs'
import { viteSingleFile } from "vite-plugin-singlefile"

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        lib: {
            entry: 'src/editor/index.js',
            formats: ['cjs']
        },
        rollupOptions: {
            input: 'src/editor/index.js',
            output: {
                dir: 'resources/dist',
                entryFileNames: 'deconz-editor.js'
            }
        },
        emptyOutDir: true
    },
    plugins: [
        commonjs(),
        viteSingleFile()
    ]
})