jQuery(document).ready(function(){	
onloadmethod();	

  // Store details overflow off
  jQuery(document).ready(function () {
      if (jQuery('section.store-details-section').length > 0) {
          jQuery('body').addClass('overflow-none');
      }
  });

    // Store details overflow off
  jQuery(document).ready(function () {
      if (jQuery('section.cart-section').length > 0) {
          jQuery('body').addClass('overflow-none');
      }
  });

      // Store details overflow off
  jQuery(document).ready(function () {
      if (jQuery('section.checkout-section').length > 0) {
          jQuery('body').addClass('overflow-none');
      }
  });

  


  // Price Range Start -----------------

  const rangeInput = document.querySelectorAll(".range-input input"),
  priceInput = document.querySelectorAll(".price-input input"),
  range = document.querySelector(".slider .progress");
  let priceGap = 1000;

  priceInput.forEach((input) => {
    input.addEventListener("input", (e) => {
      let minPrice = parseInt(priceInput[0].value),
        maxPrice = parseInt(priceInput[1].value);

      if (maxPrice - minPrice >= priceGap && maxPrice <= rangeInput[1].max) {
        if (e.target.className === "input-min") {
          rangeInput[0].value = minPrice;
          range.style.left = (minPrice / rangeInput[0].max) * 100 + "%";
        } else {
          rangeInput[1].value = maxPrice;
          range.style.right = 100 - (maxPrice / rangeInput[1].max) * 100 + "%";
        }
      }
    });
  });

  rangeInput.forEach((input) => {
    input.addEventListener("input", (e) => {
      let minVal = parseInt(rangeInput[0].value),
        maxVal = parseInt(rangeInput[1].value);

      if (maxVal - minVal < priceGap) {
        if (e.target.className === "range-min") {
          rangeInput[0].value = maxVal - priceGap;
        } else {
          rangeInput[1].value = minVal + priceGap;
        }
      } else {
        priceInput[0].value = minVal;
        priceInput[1].value = maxVal;
        range.style.left = (minVal / rangeInput[0].max) * 100 + "%";
        range.style.right = 100 - (maxVal / rangeInput[1].max) * 100 + "%";
      }
    });
  });


  // Price Range End -----------------



jQuery(document).ready(function ($) {

    // Check if Slick is loaded
    if (typeof $.fn.slick === 'undefined') {
        console.error('Slick JS not loaded');
        return;
    }

    // Init Thumbnail slider FIRST
    if (!$('.thumb-nav').hasClass('slick-initialized')) {
        $('.thumb-nav').slick({
            slidesToShow: 3,
            slidesToScroll: 1,
            infinite: false,
            centerPadding: '20px',
            asNavFor: '.product-image-slider',
            dots: false,
            arrows: false,
            centerMode: false,
            draggable: true,
            speed: 200,
            focusOnSelect: true,
        });
    }

    // Init Main slider
    if (!$('.product-image-slider').hasClass('slick-initialized')) {
        $('.product-image-slider').slick({
            slidesToShow: 1,
            slidesToScroll: 1,
            infinite: false,
            arrows: false,
            fade: true,
            autoplay: false,
            autoplaySpeed: 4000,
            speed: 300,
            lazyLoad: 'ondemand',
            asNavFor: '.thumb-nav',
        });
    }

    // Sync active thumbnail
    $('.product-image-slider').on('afterChange', function (event, slick, currentSlide) {
        $('.thumb-nav .slick-slide').removeClass('slick-current');
        $('.thumb-nav .slick-slide:not(.slick-cloned)')
            .eq(currentSlide)
            .addClass('slick-current');
    });

});



/*--------------*/


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
    

    // gallery slider
    jQuery(".store-banner-carousel").owlCarousel({
        loop: false,
        margin: 10,
        nav: true,
        dots: false,
        autoplay: false,
        autoplayTimeout: 3000,
        navText: [""],
        responsive:{
            0:{ items:1, nav: false, },
            600:{ items:2 , nav: true,},
            1000:{ items:2 },
            1200:{ items:3 },
            1400:{ items:3 },
        }
    });







});



jQuery(window).resize(function(){	
	onloadmethod();	  
});

function onloadmethod(){	
	var fullwidth = jQuery('.fullwidth').width();
	jQuery('.fullwidth').css('left', -fullwidth/2)
}


// aos init
if (typeof AOS !== 'undefined') {
    AOS.init();
}


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





// Smooth Scrolling animation Start -----------------

let currentRotation = 0;
let targetRotation = 0;
let ease = 0.08;

document.addEventListener("DOMContentLoaded", function () {

    const img = document.querySelector(".build-bg img");

    if (!img) return;

    window.addEventListener("scroll", function () {
        targetRotation = window.scrollY * 0.3;
    });

    function animate() {
        currentRotation += (targetRotation - currentRotation) * ease;

        img.style.transform = "rotate(" + currentRotation + "deg)";

        requestAnimationFrame(animate);
    }

    animate();
});


// Smooth Scrolling animation End -----------------



