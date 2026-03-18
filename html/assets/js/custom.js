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





});



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





// Smooth Scrolling animation Start -----------------

let currentRotation = 0;
let targetRotation = 0;
let ease = 0.08; // smaller = smoother

window.addEventListener("scroll", function() {
    let scrollY = window.scrollY;
    targetRotation = scrollY * 0.3;
});

function animate() {
    currentRotation += (targetRotation - currentRotation) * ease;

    document.querySelector(".build-bg img").style.transform =
        "rotate(" + currentRotation + "deg)";

    requestAnimationFrame(animate);
}

animate();


// Smooth Scrolling animation End -----------------







