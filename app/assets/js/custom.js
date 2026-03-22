jQuery(document).ready(function(){	
onloadmethod();	


    jQuery('[data-fancybox="client_gallery"]').fancybox({
        buttons: [
        "slideShow",
        "thumbs",
        "zoom",
        "fullScreen",
        "share",
        "close"
        ],
        loop: false,
        protect: true
    });

        



    jQuery(".testimonial-carousel").owlCarousel({
        loop: true,
        margin: 10,
        nav: true,
        autoplay: true,
        autoplayTimeout: 3000,
        responsive:{
            0:{ items:1, nav: false, },
            600:{ items:2 , nav: true,},
            1000:{ items:3 }
        }
    });


    // gallery slider
    jQuery(".gallery-carousel").owlCarousel({
        loop: false,
        margin: 10,
        nav: true,
        dots: false,
        autoplay: false,
        autoplayTimeout: 3000,
        navText: [""],
        responsive:{
            0:{ items:2, nav: false, },
            600:{ items:2 , nav: true,},
            1000:{ items:3 },
            1200:{ items:4 },
            1400:{ items:5 },
        }
    });
    





    // window.addEventListener("scroll", function() {
    //     let scrollY = window.scrollY;
    //     let rotateValue = scrollY * 0.3; // adjust speed here
    //     document.querySelector(".build-bg img").style.transform =
    //         "rotate(" + rotateValue + "deg)";
    // });




jQuery(function ($) {
    $(window).on('scroll', function () {
        $('.match-search .header').toggleClass('fix', $(this).scrollTop() > 60);
    });
});




// Match Control box active class JS ----
jQuery(document).ready(function ($) {
    $('.control-box').on('click', function () {
        $('.control-box').removeClass('active'); // remove from all
        $(this).addClass('active'); // add to clicked
    });
});




});


// INput show password JS
document.addEventListener("click", function (e) {
    const toggleBtn = e.target.closest(".toggle-password");
    if (!toggleBtn) return;

    const wrapper = toggleBtn.closest(".password-group");
    const passwordInput = wrapper.querySelector(".password-input");
    const eyeIcon = toggleBtn.querySelector("i");

    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";

    eyeIcon.classList.toggle("fa-eye");
    eyeIcon.classList.toggle("fa-eye-slash");
});



// Full width JS

jQuery(window).resize(function(){	
	onloadmethod();	  
});


function onloadmethod(){	
	var fullwidth = jQuery('.fullwidth').width();
	jQuery('.fullwidth').css('left', -fullwidth/2)
}


AOS.init();




// Mobile Dropdown menu -----------

document.addEventListener("DOMContentLoaded", function() {
    const dropdownMenuList = document.querySelectorAll(".dropdown-submenu .dropdown-menu");

    dropdownMenuList.forEach(function(dropdownMenu) {
      const dropdownToggle = dropdownMenu.closest(".dropdown-submenu").querySelector(".dropdown-toggle");
  
      dropdownToggle.addEventListener("click", function(event) {
        event.preventDefault();
        event.stopPropagation();
        dropdownMenu.classList.toggle("show");
      });
    });
  });

  // Mobile Dropdown menu End-----------


animate();


// Smooth Scrolling animation End -----------------


// Sticky Header
