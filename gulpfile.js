const gulp = require('gulp');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const umd = require('gulp-umd');
const pump = require('pump');

function buildDebug () {
  return gulp.src(['src/**/*.js'])
    .pipe(concat('spck-embed.js'))
    .pipe(umd({
      exports: function (file) {
        return 'SpckEditor';
      },
      namespace: function (file) {
        return 'SpckEditor';
      }
    }))
    .pipe(gulp.dest('./dist'));
}

function buildProd (cb) {
  pump([
    gulp.src(['dist/spck-embed.js']),
    concat('spck-embed.min.js'),
    uglify(),
    gulp.dest('./dist/')
  ], cb);
}

const build = gulp.parallel(buildDebug, buildProd)

module.exports = {
  buildDebug,
  buildProd,
  build
}
