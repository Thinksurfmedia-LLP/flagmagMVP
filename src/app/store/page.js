"use client";

import { useState, useEffect, Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookDemoModal from "@/components/BookDemoModal";
import ScrollToContent from "@/components/ScrollToContent";
import Link from "next/link";

export default function StorePage() {
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    // Custom JS from store.html for hover effects and number spinner
    const initScripts = () => {
        if (typeof window !== 'undefined' && window.$) {
            window.$('.product-card').off('mouseenter').on('mouseenter', function () {
                var $wrap = window.$(this).find('.buttom-wrap');
                var actualHeight = $wrap[0].scrollHeight;
        
                $wrap.css('max-height', actualHeight + 'px');
                window.$(this).find('.product-content-area').css('margin-top', '-' + actualHeight + 'px');
            });
        
            window.$('.product-card').off('mouseleave').on('mouseleave', function () {
                window.$(this).find('.buttom-wrap').css('max-height', '0');
                window.$(this).find('.product-content-area').css('margin-top', '0');
            });

            // Number spinner logic
            window.$('.number-spinner>.ns-btn>a').off('click').on('click', function() {
                var btn = window.$(this),
                oldValue = btn.closest('.number-spinner').find('input').val().trim(),
                newVal = 0;
    
                if (btn.attr('data-dir') === 'up') {
                    newVal = parseInt(oldValue) + 1;
                } else {
                    if (oldValue > 1) {
                        newVal = parseInt(oldValue) - 1;
                    } else {
                        newVal = 1;
                    }
                }
                btn.closest('.number-spinner').find('input').val(newVal);
            });
            window.$('.number-spinner>input').off('keypress').on('keypress', function(evt) {
                evt = (evt) ? evt : window.event;
                var charCode = (evt.which) ? evt.which : evt.keyCode;
                if (charCode > 31 && (charCode < 48 || charCode > 57)) {
                    return false;
                }
                return true;
            });
            
            // Initialize owl carousel
            if (window.$('.store-banner-carousel').length) {
                window.$('.store-banner-carousel').owlCarousel({
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
            }
        }
    };
    
    // Poll to wait for jQuery and owlCarousel
    const checkDependencies = setInterval(() => {
        if (typeof window !== 'undefined' && window.$ && window.$.fn && window.$.fn.owlCarousel) {
            clearInterval(checkDependencies);
            initScripts();
        }
    }, 100);

    return () => clearInterval(checkDependencies);
  }, []);

  return (
    <>
      <BookDemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
      <Header onBookDemo={() => setDemoOpen(true)} />
      <Suspense fallback={null}>
        <ScrollToContent />
      </Suspense>

      <section className="innerpage-section">
          <div className="banner-area"><img src="/assets/images/store-banner1.jpg" alt="" /></div>
          <div className="container">
              <div className="breadcrumb-area">
                  <h5>Home // Store</h5>
                  <h1>Our store</h1>
              </div>
          </div>
      </section>

      <section className="store-banner-section section-padding-top" id="main-content">
          <div className="container">
              <div className="row align-items-center text-center gy-3 justify-content-between mb-4">
                  <div className="col-sm-auto">
                      <h2>Shop by Activity</h2>
                  </div>
                  <div className="col-sm-auto">
                      <Link href="#" className="btn btn-primary">See All</Link>
                  </div>
              </div>

              <div className="store-banner-carousel-wrapper">
                  <div className="store-banner-carousel owl-carousel owl-theme">
                      <div className="item">
                          <img src="/assets/images/sb1.png" alt="" />
                      </div>
                      <div className="item">
                          <img src="/assets/images/sb2.png" alt="" />
                      </div>
                      <div className="item">
                          <img src="/assets/images/sb3.png" alt="" />
                      </div>
                  </div>
              </div>
          </div>
      </section>

      <section className="store-list-section section-padding">
          <div className="container">
              <div className="row align-items-start">
                  <div className="col-auto store-filter-area">
                      <h4>Filters</h4>
                      <div className="filter-wrap">
                          <h5>categories</h5>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="type5" />
                              <label className="form-check-label" htmlFor="type5">
                                  Goal Keeper <span>(255)</span>
                              </label>
                          </div>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="type1" />
                              <label className="form-check-label" htmlFor="type1">
                                  Defender <span>(142)</span>
                              </label>
                          </div>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="type2" />
                              <label className="form-check-label" htmlFor="type2">Midfielder <span>(79)</span></label>
                          </div>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="type3" />
                              <label className="form-check-label" htmlFor="type3">Men&apos;s jersey <span>(79)</span></label>
                          </div>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="type4" />
                              <label className="form-check-label" htmlFor="type4">Headband <span>(79)</span></label>
                          </div>
                      </div>
                      <div className="filter-wrap">
                          <h5>price</h5>

                          <div className="price-filter">
                              
                              <div className="slider">
                                  <div className="progress"></div>
                              </div>
                              <div className="range-input">
                                  <input type="range" className="range-min" min="0" max="10000" defaultValue="2500" step="100" />
                                  <input type="range" className="range-max" min="0" max="10000" defaultValue="7500" step="10" />
                              </div>
                              <div className="price-input">
                                  <div className="field">
                                  <span>$</span>
                                  <input type="number" className="input-min" defaultValue="2500" />
                                  </div>
                                  <div className="separator">-</div>
                                  <div className="field">
                                  <span>$</span>
                                  <input type="number" className="input-max" defaultValue="7500" />
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="filter-wrap color-filter">
                          <h5>Color</h5>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="color1" />
                              <label className="form-check-label" htmlFor="color1">
                                 <span style={{background: "#fff"}}></span> white
                              </label>
                          </div>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="color2" />
                              <label className="form-check-label" htmlFor="color2">
                                 <span style={{background: "#000"}}></span> Black
                              </label>
                          </div>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="color3" />
                              <label className="form-check-label" htmlFor="color3">
                                 <span style={{background: "#f00"}}></span> Red
                              </label>
                          </div>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="color4" />
                              <label className="form-check-label" htmlFor="color4">
                                 <span style={{background: "#00f"}}></span> Blue
                              </label>
                          </div>
                          <div className="form-check">
                              <input className="form-check-input" type="checkbox" value="" id="color5" />
                              <label className="form-check-label" htmlFor="color5">
                                 <span style={{background: "#0f0"}}></span> Green
                              </label>
                          </div>
                      </div>
                  </div>

                  <div className="col">
                      <div className="product-list row g-4">
                          {/* Loop through products 9 times for demonstration just like the original HTML */}
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => (
                          <div className="col-md-6 col-xl-4" key={item}>
                              <div className="product-card">
                                  <div className="product-image-area">
                                      <Link href="/store-details"><img src="/assets/images/product1.jpg" alt="" /></Link>
                                  </div>
                                  <div className="product-content-area">
                                      <h5><Link href="/store-details" style={{color: 'inherit', textDecoration: 'none'}}>Belt System</Link></h5>
                                      <p>ClipPro Flag Belt System</p>
                                      <div className="price">
                                          <span>$99</span>
                                          <bdi>$129</bdi>
                                          <bdo>(50% OFF)</bdo>
                                      </div>
                                  </div>
                                  <div className="buttom-wrap">
                                      <div className="number-spinner qty">
                                          <h5>Qty</h5>
                                          <span className="ns-btn">
                                              <a data-dir="dwn"><i className="fa-solid fa-minus"></i></a>
                                          </span>
                                          <input type="text" className="pl-ns-value" defaultValue="1" maxLength={2} />
                                          <span className="ns-btn">
                                              <a data-dir="up"><i className="fa-solid fa-plus"></i></a>
                                          </span>
                                      </div>
                                      <Link href="#" className="btn btn-primary">Add to cart</Link> 
                                  </div>
                              </div>
                          </div>
                          ))}
                      </div>

                      <div className="navigation">
                          <ul className="pagination">
                              <li className="page-item"><Link className="page-link" href="#"><i className="fa-solid fa-angles-left"></i></Link></li>
                              <li className="page-item active"><Link className="page-link" href="#">1</Link></li>
                              <li className="page-item"><Link className="page-link" href="#">2</Link></li>
                              <li className="page-item"><Link className="page-link" href="#">3</Link></li>
                              <li className="page-item"><Link className="page-link" href="#"><i className="fa-solid fa-angles-right"></i></Link></li>
                          </ul>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      <Footer />
    </>
  );
}
