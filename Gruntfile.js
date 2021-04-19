module.exports = grunt => {

    // Load all grunt tasks matching the ['grunt-*', '@*/grunt-*'] patterns
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: true
            },
            dist: ['Gruntfile.js', 'src/**/*.js']
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
                        'src/editor/DeconzListItemListEditor.js',
                        'src/editor/DeconzListItemEditor.js',
                        'src/editor/DeconzOutputRuleListEditor.js',
                        'src/editor/DeconzOutputRuleEditor.js',
                        'src/editor/DeconzCommandListEditor.js',
                        'src/editor/DeconzCommandEditor.js',
                    ]
                }
            }
        }
    });

    grunt.registerTask('build', ['jshint', 'uglify']);
};