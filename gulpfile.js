var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var umd = require('gulp-umd');
var pump = require('pump');

gulp.task('build', ['build-minify', 'build-debug']);

gulp.task('build-debug', function () {
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
});

gulp.task('build-minify', ['build-debug'], function (cb) {
  pump([
    gulp.src(['dist/spck-embed.js']),
    concat('spck-embed.min.js'),
    uglify(),
    gulp.dest('./dist/')
  ], cb);
});
