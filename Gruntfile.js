module.exports = grunt => {

    // Load all grunt tasks matching the ['grunt-*', '@*/grunt-*'] patterns
    require('load-grunt-tasks')(grunt);

    let srcFiles = ['Gruntfile.js', 'src/**/*.js'];

    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: true
            },
            dist: srcFiles
        },
        uglify: {
            options: {
                mangle: false,
                sourceMap: true
            },
            dist: {
                files: {
                    'resources/dist/deconz-editor.js': [
                        'src/editor/DeconzEditor.js',
                        'src/editor/DeconzMainEditor.js',

                        'src/editor/DeconzDeviceListEditor.js',
                        'src/editor/DeconzQueryEditor.js',
                        'src/editor/DeconzDeviceEditor.js',
                        'src/editor/DeconzSpecific*Editor.js',

                        'src/editor/DeconzListItem*Editor.js',
                        'src/editor/DeconzOutput*Editor.js',
                        'src/editor/DeconzCommand*Editor.js',
                    ]
                }
            }
        },
        watch: {
            js: {
                files: srcFiles,
                tasks: ['build']
            }
        }
    });

    grunt.registerTask('build', ['jshint', 'uglify']);
};