#!/usr/bin/env node

const concurrently = require('concurrently')

concurrently([
    {
        command: 'npx grunt watch',
        name: 'grunt',
        prefixColor: '#f39c12',
    },
    {
        command: 'node-red',
        name: 'node-red',
        prefixColor: '#3498db',
        dependsOn: ['grunt'],
    },
])
