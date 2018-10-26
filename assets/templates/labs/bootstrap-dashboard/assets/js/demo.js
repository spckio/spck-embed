type = ['','info','success','warning','danger'];


demo = {
  initPickColor: function(){
    $('.pick-class-label').click(function(){
      var new_class = $(this).attr('new-class');
      var old_class = $('#display-buttons').attr('data-class');
      var display_div = $('#display-buttons');
      if(display_div.length) {
        var display_buttons = display_div.find('.btn');
        display_buttons.removeClass(old_class);
        display_buttons.addClass(new_class);
        display_div.attr('data-class', new_class);
      }
    });
  },
  
  checkScrollForTransparentNavbar: debounce(function() {
    $navbar = $('.navbar[color-on-scroll]');
    scroll_distance = $navbar.attr('color-on-scroll') || 500;
    
    if($(document).scrollTop() > scroll_distance ) {
      if(transparent) {
        transparent = false;
        $('.navbar[color-on-scroll]').removeClass('navbar-transparent');
        $('.navbar[color-on-scroll]').addClass('navbar-default');
      }
    } else {
      if( !transparent ) {
        transparent = true;
        $('.navbar[color-on-scroll]').addClass('navbar-transparent');
        $('.navbar[color-on-scroll]').removeClass('navbar-default');
      }
    }
  }, 17),
  
  initDocChartist: function(){
    var dataSales = {
      labels: ['9:00AM', '12:00AM', '3:00PM', '6:00PM', '9:00PM', '12:00PM', '3:00AM', '6:00AM'],
      series: [
        [287, 385, 490, 492, 554, 586, 698, 695, 752, 788, 846, 944],
        [67, 152, 143, 240, 287, 335, 435, 437, 539, 542, 544, 647],
        [23, 113, 67, 108, 190, 239, 307, 308, 439, 410, 410, 509]
      ]
    };
    
    var optionsSales = {
      lineSmooth: false,
      low: 0,
      high: 800,
      showArea: true,
      height: "245px",
      axisX: {
        showGrid: false,
      },
      lineSmooth: Chartist.Interpolation.simple({
        divisor: 3
      }),
      showLine: false,
      showPoint: false,
    };
    
    var responsiveSales = [
      ['screen and (max-width: 640px)', {
        axisX: {
          labelInterpolationFnc: function (value) {
            return value[0];
          }
        }
      }]
    ];
    
    Chartist.Line('#chartHours', dataSales, optionsSales, responsiveSales);
    
    
    var data = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      series: [
        [542, 443, 320, 780, 553, 453, 326, 434, 568, 610, 756, 895],
        [412, 243, 280, 580, 453, 353, 300, 364, 368, 410, 636, 695]
      ]
    };
    
    var options = {
      seriesBarDistance: 10,
      axisX: {
        showGrid: false
      },
      height: "245px"
    };
    
    var responsiveOptions = [
      ['screen and (max-width: 640px)', {
        seriesBarDistance: 5,
        axisX: {
          labelInterpolationFnc: function (value) {
            return value[0];
          }
        }
      }]
    ];
    
    Chartist.Bar('#chartActivity', data, options, responsiveOptions);
    
    var dataPreferences = {
      series: [
        [25, 30, 20, 25]
      ]
    };
    
    var optionsPreferences = {
      donut: true,
      donutWidth: 40,
      startAngle: 0,
      total: 100,
      showLabel: false,
      axisX: {
        showGrid: false
      }
    };
    
    Chartist.Pie('#chartPreferences', dataPreferences, optionsPreferences);
    
    Chartist.Pie('#chartPreferences', {
      labels: ['62%','32%','6%'],
      series: [62, 32, 6]
    });
  },
  
  initChartist: function(){
    
    var dataSales = {
      labels: ['9:00AM', '12:00AM', '3:00PM', '6:00PM', '9:00PM', '12:00PM', '3:00AM', '6:00AM'],
      series: [
        [287, 385, 490, 492, 554, 586, 698, 695, 752, 788, 846, 944],
        [67, 152, 143, 240, 287, 335, 435, 437, 539, 542, 544, 647],
        [23, 113, 67, 108, 190, 239, 307, 308, 439, 410, 410, 509]
      ]
    };
    
    var optionsSales = {
      lineSmooth: false,
      low: 0,
      high: 800,
      showArea: true,
      height: "245px",
      axisX: {
        showGrid: false,
      },
      lineSmooth: Chartist.Interpolation.simple({
        divisor: 3
      }),
      showLine: false,
      showPoint: false,
    };
    
    var responsiveSales = [
      ['screen and (max-width: 640px)', {
        axisX: {
          labelInterpolationFnc: function (value) {
            return value[0];
          }
        }
      }]
    ];
    
    Chartist.Line('#chartHours', dataSales, optionsSales, responsiveSales);
    
    
    var data = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      series: [
        [542, 443, 320, 780, 553, 453, 326, 434, 568, 610, 756, 895],
        [412, 243, 280, 580, 453, 353, 300, 364, 368, 410, 636, 695]
      ]
    };
    
    var options = {
      seriesBarDistance: 10,
      axisX: {
        showGrid: false
      },
      height: "245px"
    };
    
    var responsiveOptions = [
      ['screen and (max-width: 640px)', {
        seriesBarDistance: 5,
        axisX: {
          labelInterpolationFnc: function (value) {
            return value[0];
          }
        }
      }]
    ];
    
    Chartist.Bar('#chartActivity', data, options, responsiveOptions);
    
    var dataPreferences = {
      series: [
        [25, 30, 20, 25]
      ]
    };
    
    var optionsPreferences = {
      donut: true,
      donutWidth: 40,
      startAngle: 0,
      total: 100,
      showLabel: false,
      axisX: {
        showGrid: false
      }
    };
    
    Chartist.Pie('#chartPreferences', dataPreferences, optionsPreferences);
    
    Chartist.Pie('#chartPreferences', {
      labels: ['62%','32%','6%'],
      series: [62, 32, 6]
    });
  },
  
  showNotification: function(from, align){
    color = Math.floor((Math.random() * 4) + 1);
    
    $.notify({
      icon: "pe-7s-gift",
      message: "Welcome to <b>Light Bootstrap Dashboard</b> - a beautiful freebie for every web developer."
      
    },{
      type: type[color],
      timer: 4000,
      placement: {
        from: from,
        align: align
      }
    });
  }
  
  
}
