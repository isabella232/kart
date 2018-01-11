const kart = require('../lib'),
      should = require('should'),
      testUtil = require('./test-util');

describe('kart.archive', function () {
    this.timeout(30000);

    beforeEach(() => {
        return testUtil.setupS3();
    });
    afterEach(() => {
        testUtil.cleanupBuildDirectories();
        return testUtil.teardownS3();
    });
    describe('.store()', () => {
        it('empty directory', () => {
            let buildDir;

            return testUtil.generateBuildDirectory({
                fileCount: 0,
                subdirs: 0
            }).then((dir) => {
                buildDir = dir;
                return kart.archive.store(buildDir.path, 'testing', 'sync', '0.1.2', null, null, {revision: '1234567'});
            }).then((archive) => {
                archive.should.containEql({
                    project: 'testing',
                    channel: 'sync',
                    version: '0.1.2',
                    number: 1,
                    arch: 'all',
                    metadata: {
                        revision: '1234567'
                    }
                });

                return testUtil.assertArchive(buildDir, archive);
            });
        });
        it('no subdirectories', () => {
            let buildDir;

            return testUtil.generateBuildDirectory({
                fileCount: [1, 5],
                subdirs: 0
            }).then((dir) => {
                buildDir = dir;
                return kart.archive.store(buildDir.path, 'testing', 'sync', '0.3.2', null, null, {revision: '3234567'});
            }).then((archive) => {
                archive.should.containEql({
                    project: 'testing',
                    channel: 'sync',
                    version: '0.3.2',
                    number: 1,
                    arch: 'all',
                    metadata: {
                        revision: '3234567'
                    }
                });

                return testUtil.assertArchive(buildDir, archive);
            });
        });
        it('with subdirectories', () => {
            let buildDir;

            return testUtil.generateBuildDirectory({
                fileCount: [10, 20],
                subdirs: 3
            }).then((dir) => {
                buildDir = dir;
                return kart.archive.store(buildDir.path, 'testing', 'sync', '0.5.6', null, 'armv7');
            }).then((archive) => {
                archive.should.containEql({
                    project: 'testing',
                    channel: 'sync',
                    version: '0.5.6',
                    number: 1,
                    arch: 'armv7'
                });

                return testUtil.assertArchive(buildDir, archive);
            });
        });
        it('sets revision metadata', () => {
            return testUtil.generateBuildDirectory({
                fileCount: [6, 12],
                subdirs: 3
            }).then((buildDir) => {
                return kart.archive.store(buildDir.path, 'testing', 'sync', '0.1.1', null, null, {revision: '1134567'});
            }).then((archive) => {
                archive.should.containEql({
                    project: 'testing',
                    channel: 'sync',
                    version: '0.1.1',
                    number: 1,
                    arch: 'all',
                    metadata: {
                        revision: '1134567'
                    }
                });
            });
        });
        it('infers build number properly', () => {
            let buildDirs;

            return Promise.all([
                testUtil.generateBuildDirectory({fileCount: 4}),
                testUtil.generateBuildDirectory({fileCount: 2})
            ]).then((dirs) => {
                buildDirs = dirs;
                return kart.archive.store(buildDirs[0].path, 'testing', 'sync', '0.1.1');
            }).then((archive) => {
                archive.should.containEql({
                    project: 'testing',
                    channel: 'sync',
                    version: '0.1.1',
                    number: 1,
                    arch: 'all'
                });

                return kart.archive.store(buildDirs[1].path, 'testing', 'sync', '0.1.1')
            }).then((archive) => {
                archive.number.should.eql(2);
            });
        });
        it('rejects non-existent directory', () => {
            return kart.archive.store('/bogus/path/lol', 'testing', 'sync', '0.1.1').should.be.rejected();
        });
        it('rejects non-existent project', () => {
            return testUtil.generateBuildDirectory({
                fileCount: 1,
                subdirs: 0
            }).then((buildDir) => {
                return kart.archive.store(buildDir.path, 'bogus-project', 'sync', '0.1.2');
            }).should.be.rejected();
        });
        it('rejects non-existent channel', () => {
            return testUtil.generateBuildDirectory({
                fileCount: 1,
                subdirs: 0
            }).then((buildDir) => {
                return kart.archive.store(buildDir.path, 'testing', 'bogus-channel', '0.1.2');
            }).should.be.rejected();
        });
    });

    describe('.list()', () => {
        it('no builds', () => {
            return kart.archive.list('testing', 'sync').then((builds) => {
                builds.length.should.be.zero;
            });
        });
        it('one build', () => {
            return testUtil.generateAndArchiveBuilds([
                {project: 'testing', channel: 'sync', version: '1.2.3'}
            ]).then((builds) => {
                return kart.archive.list('testing', 'sync');
            }).then((list) => {
                list.length.should.be.eql(1);
            });
        });
        it('more builds', () => {
            return testUtil.generateAndArchiveBuilds([
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.4'}
            ]).then((builds) => {
                return kart.archive.list('testing', 'sync');
            }).then((list) => {
                list.length.should.be.eql(2);
            });
        });

        it('rejects non-existent project', () => {
            return kart.archive.list('bogus-project', 'sync').should.be.rejected();
        });
        it('rejects non-existent channel', () => {
            return kart.archive.list('testing', 'bogus-channel').should.be.rejected();
        });

        it('filter by one key', () => {
            return testUtil.generateAndArchiveBuilds([
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.4'}
            ]).then((builds) => {
                return kart.archive.list('testing', 'sync', {
                    filter: {
                        version: '1.2.3'
                    }
                });
            }).then((list) => {
                list.length.should.be.eql(3);
            });
        });
        it('filter by two keys', () => {
            return testUtil.generateAndArchiveBuilds([
                {project: 'testing', channel: 'sync', version: '1.2.3', arch: 'amd64'},
                {project: 'testing', channel: 'sync', version: '1.2.3', arch: 'amd64'},
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.4'}
            ]).then((builds) => {
                return kart.archive.list('testing', 'sync', {
                    filter: {
                        version: '1.2.3',
                        arch: 'amd64'
                    }
                });
            }).then((list) => {
                list.length.should.be.eql(2);
            });
        });

        it('sort', () => {
            return testUtil.generateAndArchiveBuilds([
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.3'}
            ]).then((builds) => {
                return kart.archive.list('testing', 'sync', {
                    sort: {
                        key: ['project', 'number'],
                        order: -1
                    }
                });
            }).then((list) => {
                list.length.should.be.eql(4);
                list[0].number.should.be.eql(4);
                list[3].number.should.be.eql(1);
            });

        });

        it('limit', () => {
            return testUtil.generateAndArchiveBuilds([
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.3'}
            ]).then((builds) => {
                return kart.archive.list('testing', 'sync', {
                    sort: {
                        key: ['number'],
                        order: -1
                    },
                    limit: 2
                });
            }).then((list) => {
                list.length.should.be.eql(2);
                list[0].number.should.be.eql(4);
                list[1].number.should.be.eql(3);
            });
        });
    });

    describe('.remove()', () => {
        it('regular build', () => {
            return testUtil.generateAndArchiveBuilds([
                {project: 'testing', channel: 'sync', version: '1.2.3'},
                {project: 'testing', channel: 'sync', version: '1.2.4'}
            ]).then((builds) => {
                return kart.archive.list('testing', 'sync');
            }).then((list) => {
                list.length.should.be.eql(2);
                return kart.archive.remove(list[0]);
            }).then(() => {
                return kart.archive.list('testing', 'sync');
            }).then((list) => {
                list.length.should.be.eql(1);
            });
        });
        it('the last build', () => {
            return testUtil.generateAndArchiveBuilds([
                {project: 'testing', channel: 'sync', version: '1.2.3'}
            ]).then((builds) => {
                return kart.archive.list('testing', 'sync');
            }).then((list) => {
                list.length.should.be.eql(1);
                return kart.archive.remove(list[0]);
            }).then(() => {
                return kart.archive.list('testing', 'sync');
            }).then((list) => {
                list.length.should.be.eql(0);
            });
        });
        it('ignore deleting non-existent build', () => {
            let buildObject;

            return testUtil.generateAndArchiveBuilds([
                {project: 'testing', channel: 'sync', version: '1.2.3'}
            ]).then((builds) => {
                return kart.archive.list('testing', 'sync');
            }).then((list) => {
                list.length.should.be.eql(1);
                buildObject = list[0];
                return kart.archive.remove(list[0]);
            }).then(() => {
                return kart.archive.remove(buildObject).should.be.fulfilled();
            });
        });
    });
});
