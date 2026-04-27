"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookDemoModal from "@/components/BookDemoModal";
import Script from "next/script";
import Link from "next/link";

export default function StoreDetailsPage() {
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    // Custom JS from store-details.html for hover effects and number spinner
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
            
            // Init Slick
            if (window.$.fn.slick) {
                if (!window.$('.thumb-nav').hasClass('slick-initialized')) {
                    window.$('.thumb-nav').slick({
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
                if (!window.$('.product-image-slider').hasClass('slick-initialized')) {
                    window.$('.product-image-slider').slick({
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
                window.$('.product-image-slider').off('afterChange').on('afterChange', function (event, slick, currentSlide) {
                    window.$('.thumb-nav .slick-slide').removeClass('slick-current');
                    window.$('.thumb-nav .slick-slide:not(.slick-cloned)')
                        .eq(currentSlide)
                        .addClass('slick-current');
                });
            }
        }
    };
    
    // Poll to wait for jQuery and slick
    const checkDependencies = setInterval(() => {
        if (typeof window !== 'undefined' && window.$ && window.$.fn && window.$.fn.slick) {
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

      <section className="store-details-section section-padding">
          <div className="container">
              <div className="row">
                  <div className="col-12">
                      <div className="breadcrumb">
                          <Link href="/">Home</Link> <span>//</span> <Link href="/store">Store</Link> <span>//</span> Product details
                      </div>
                  </div>
                  <div className="col-lg-7">
                      <div className="product-images demo-gallery">
                          {/* Begin Product Images Slider */}
                          <div className="main-img-slider product-image-slider">
                              <a data-fancybox="gallery" href="/assets/images/pro1.jpg"><img src="/assets/images/pro1.jpg" className="img-fluid" alt="" /></a>
                              <a data-fancybox="gallery" href="/assets/images/pro2.jpg"><img src="/assets/images/pro2.jpg" className="img-fluid" alt="" /></a>
                              <a data-fancybox="gallery" href="/assets/images/pro3.jpg"><img src="/assets/images/pro3.jpg" className="img-fluid" alt="" /></a>
                              <a data-fancybox="gallery" href="/assets/images/pro4.jpg"><img src="/assets/images/pro4.jpg" className="img-fluid" alt="" /></a>
                          </div>
                          {/* End Product Images Slider */}
                          
                          {/* Begin product thumb nav */}
                          <ul className="thumb-nav">
                              <li><img src="/assets/images/pro1.jpg" alt="" /></li>
                              <li><img src="/assets/images/pro2.jpg" alt="" /></li>
                              <li><img src="/assets/images/pro3.jpg" alt="" /></li>
                              <li className="more"><a data-fancybox="gallery" href="/assets/images/pro4.jpg">
                                  <img src="/assets/images/pro4.jpg" alt="" />
                                  <span>+20 More</span>
                              </a></li>
                          </ul>
                          {/* End product thumb nav */}
                      </div>
                  </div>
                  <div className="col-lg-5">
                      <div className="product-details-wrap">
                          <div className="row justify-content-between">
                              <div className="col">
                                  <ul className="tag">
                                      <li><Link href="#">men</Link></li>
                                      <li><Link href="#">Shirts & Tops</Link></li>
                                  </ul>
                              </div>
                              <div className="col-auto">
                                  <ul className="social">
                                      <li><Link href="#"><i className="fa-regular fa-paper-plane"></i></Link></li>
                                      <li><Link href="#"><i className="fa-regular fa-heart"></i></Link></li>
                                  </ul>
                              </div>
                          </div>
                          <h6><img src="/assets/images/icon-hot.png" alt="" /> New</h6>
                          <h2>UA Vanish Energy Printed</h2>
                          <h4>Men&apos;s Short Sleeve</h4>
                          <div className="row justify-content-between align-items-center">
                              <div className="col-auto">
                                  <h3>$25</h3>
                              </div>
                              <div className="col-auto">
                                  <ul className="star-rating">
                                      <li><i className="fa-solid fa-star"></i></li>
                                      <li><i className="fa-solid fa-star"></i></li>
                                      <li><i className="fa-solid fa-star"></i></li>
                                      <li><i className="fa-solid fa-star"></i></li>
                                      <li><i className="fa-solid fa-star"></i></li>
                                  </ul>
                              </div>
                          </div>

                          <div className="product-image-variant">
                              <h4>Ultimate Black / Anthracite - 008</h4>
                              <div className="form-group">
                                  <div className="form-check">
                                      <input className="" type="radio" name="image-variant" id="img1" />
                                      <label htmlFor="img1"><img src="/assets/images/pro1.jpg" alt="" /></label>
                                  </div>
                                  <div className="form-check">
                                      <input className="" type="radio" name="image-variant" id="img2" defaultChecked />
                                      <label htmlFor="img2"><img src="/assets/images/pro2.jpg" alt="" /></label>
                                  </div>
                              </div>
                          </div>

                          <div className="size-wrap">
                              <div className="size-row">
                                  <h4>Size</h4>
                                  <h4><Link href="#">Size & Fit Guide</Link></h4>
                              </div>
                              <div className="form-group">
                                  <div className="form-check">
                                      <input type="radio" name="size-variant" id="size1" />
                                      <label htmlFor="size1">EXTRA SMALL</label>
                                  </div>
                                  <div className="form-check">
                                      <input type="radio" name="size-variant" id="size2" defaultChecked />
                                      <label htmlFor="size2">Small</label>
                                  </div>
                                  <div className="form-check">
                                      <input type="radio" name="size-variant" id="size3" defaultChecked />
                                      <label htmlFor="size3">Medium</label>
                                  </div>
                                  <div className="form-check">
                                      <input type="radio" name="size-variant" id="size4" defaultChecked />
                                      <label htmlFor="size4">large</label>
                                  </div>
                                  <div className="form-check">
                                      <input type="radio" name="size-variant" id="size5" defaultChecked />
                                      <label htmlFor="size5">Extra large</label>
                                  </div>
                              </div>
                          </div>

                          <div className="quantity-wrap">
                              <h4>Quantity</h4>
                              <div className="number-spinner qty">
                                  <span className="ns-btn">
                                      <a data-dir="dwn"><i className="fa-solid fa-minus"></i></a>
                                  </span>
                                  <input type="text" className="pl-ns-value" defaultValue="1" maxLength={2} />
                                  <span className="ns-btn">
                                      <a data-dir="up"><i className="fa-solid fa-plus"></i></a>
                                  </span>
                              </div>
                          </div>

                          <div className="ship-type">
                              <div className="form-check">
                                  <input type="radio" name="ship-type" id="st1" />
                                  <label htmlFor="st1" className="ship">
                                      <h6>Ship</h6>
                                      <p>Select a size</p>
                                  </label>
                              </div>
                              <div className="form-check">
                                  <input type="radio" name="ship-type" id="st2" />
                                  <label htmlFor="st2" className="pick">
                                      <h6>Pick Up</h6>
                                      <p>Select a size</p>
                                  </label>
                              </div>
                          </div>

                          <Link href="#" className="btn btn-primary w-100">Add to Bag</Link>

                          <div className="description-area">
                              <h5>The more you sweat, the heavier most shirts get.</h5>
                              <p>UA Vanish is light, extra stretchy, breathable, and fast drying so you can work hard without getting weighed down. It&apos;s everything you need to eliminate distractions.</p>
                          </div>

                          <div className="accordion" id="accordionExample">
                              <div className="accordion-item">
                              <h2 className="accordion-header">
                                  <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">Product Details</button>
                              </h2>
                              <div id="collapseOne" className="accordion-collapse collapse show" data-bs-parent="#accordionExample">
                                  <div className="accordion-body">
                                  <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt totam repellendus, ipsam voluptates aliquid optio placeat possimus reprehenderit quasi deserunt amet vel veniam recusandae, nam exercitationem quidem a ipsa at?</p>
                                  </div>
                              </div>
                              </div>
                              <div className="accordion-item">
                              <h2 className="accordion-header">
                                  <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">Specs & Care</button>
                              </h2>
                              <div id="collapseTwo" className="accordion-collapse collapse" data-bs-parent="#accordionExample">
                                  <div className="accordion-body">
                                  <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt totam repellendus, ipsam voluptates aliquid optio placeat possimus reprehenderit quasi deserunt amet vel veniam recusandae, nam exercitationem quidem a ipsa at?</p>
                                  </div>
                              </div>
                              </div>
                              <div className="accordion-item">
                              <h2 className="accordion-header">
                                  <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">Refund Policy</button>
                              </h2>
                              <div id="collapseThree" className="accordion-collapse collapse" data-bs-parent="#accordionExample">
                                  <div className="accordion-body">
                                  <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt totam repellendus, ipsam voluptates aliquid optio placeat possimus reprehenderit quasi deserunt amet vel veniam recusandae, nam exercitationem quidem a ipsa at?</p>
                                  </div>
                              </div>
                              </div>
                          </div>

                      </div>
                  </div>
              </div>

              <div className="row review-main">
                  <div className="col-12 text-center">
                      <h2>Reviews</h2>
                  </div>
                  <div className="col-md-6">
                      <div className="rating-part">
                          <div className="left">
                              <h3>4.9</h3>
                              <ul className="star-rating">
                                  <li><i className="fa-solid fa-star"></i></li>
                                  <li><i className="fa-solid fa-star"></i></li>
                                  <li><i className="fa-solid fa-star"></i></li>
                                  <li><i className="fa-solid fa-star"></i></li>
                                  <li><i className="fa-solid fa-star"></i></li>
                              </ul>
                              <p>Recommended : 98%</p>
                          </div>
                          <div className="right">
                              <div className="item">
                                  <span>5</span>
                                  <i className="fa-solid fa-star"></i>
                                  <div className="progress">
                                      <div className="progress-bar" role="progressbar" style={{width: "70%"}} aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"></div>
                                  </div>
                                  <span>253</span>
                              </div>
                              <div className="item">
                                  <span>4</span>
                                  <i className="fa-solid fa-star"></i>
                                  <div className="progress">
                                      <div className="progress-bar" role="progressbar" style={{width: "70%"}} aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"></div>
                                  </div>
                                  <span>121</span>
                              </div>
                              <div className="item">
                                  <span>3</span>
                                  <i className="fa-solid fa-star"></i>
                                  <div className="progress">
                                      <div className="progress-bar" role="progressbar" style={{width: "70%"}} aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"></div>
                                  </div>
                                  <span>80</span>
                              </div>
                              <div className="item">
                                  <span>2</span>
                                  <i className="fa-solid fa-star"></i>
                                  <div className="progress">
                                      <div className="progress-bar" role="progressbar" style={{width: "70%"}} aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"></div>
                                  </div>
                                  <span>30</span>
                              </div>
                              <div className="item">
                                  <span>1</span>
                                  <i className="fa-solid fa-star"></i>
                                  <div className="progress">
                                      <div className="progress-bar" role="progressbar" style={{width: "70%"}} aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"></div>
                                  </div>
                                  <span>20</span>
                              </div>

                              <p>321 Ratings</p>
                          </div>
                      </div>
                  </div>
                  <div className="col-md-6">
                      <div className="comfort-area-wrap">
                          <div className="comfort-area">
                          <h6>Comfort</h6>
                          <div className="form-group">
                              <div className="form-check">
                                  <input className="" type="radio" name="Comfort" id="c1" />
                                  <label htmlFor="c1">
                                      <img src="/assets/images/icon-circle.png" alt="" />
                                      <span>Uncomfortable</span>
                                  </label>
                              </div>
                              <div className="form-check">
                                  <input className="" type="radio" name="Comfort" id="c2" defaultChecked />
                                  <label htmlFor="c2">
                                      <img src="/assets/images/icon-circle.png" alt="" />
                                      <span>Average</span></label>
                              </div>
                              <div className="form-check">
                                  <input className="" type="radio" name="Comfort" id="c3" />
                                  <label htmlFor="c3">
                                      <img src="/assets/images/icon-circle.png" alt="" />
                                      <span>Very Comfortable</span>
                                  </label>
                              </div>
                              
                          </div>
                          </div>
                          <div className="comfort-area">
                              <h6>fit</h6>
                              <div className="form-group">
                                  <div className="form-check">
                                      <input className="" type="radio" name="fit" id="f1" />
                                      <label htmlFor="f1">
                                          <img src="/assets/images/icon-circle.png" alt="" />
                                          <span>Too small</span>
                                      </label>
                                  </div>
                                  <div className="form-check">
                                      <input className="" type="radio" name="fit" id="f2" defaultChecked />
                                      <label htmlFor="f2">
                                          <img src="/assets/images/icon-circle.png" alt="" />
                                          <span>true to Size</span></label>
                                  </div>
                                  <div className="form-check">
                                      <input className="" type="radio" name="fit" id="f3" />
                                      <label htmlFor="f3">
                                          <img src="/assets/images/icon-circle.png" alt="" />
                                          <span>Too Large</span>
                                      </label>
                                  </div>
                                  
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="col-12 text-center mt-5">
                      <Link href="#" className="btn btn-primary">Write a Review</Link>
                  </div>


                  <div className="col-12 search-review">
                      <div className="input-group">
                          <input type="text" className="form-control" placeholder="Search reviews..." />
                      </div>
                      <ul className="tag">
                          <li><Link href="#">Fit</Link></li>
                          <li><Link href="#">Comfort</Link></li>
                          <li><Link href="#">Satisfaction</Link></li>
                          <li><Link href="#">Color</Link></li>
                          <li><Link href="#">Fabric Weight</Link></li>
                          <li><Link href="#">Material</Link></li>
                          <li><Link href="#">Purchase</Link></li>
                          <li><Link href="#">Quality</Link></li>
                          <li><Link href="#">Wearing</Link></li>
                      </ul>
                      <div className="filter-area">
                          <div className="left">
                              <h5>Filter by star rating</h5>
                              <ul className="tag">
                                  <li><Link href="#">5 <i className="fa-solid fa-star"></i></Link></li>
                                  <li><Link href="#">4 <i className="fa-solid fa-star"></i></Link></li>
                                  <li><Link href="#">3 <i className="fa-solid fa-star"></i></Link></li>
                                  <li><Link href="#">2 <i className="fa-solid fa-star"></i></Link></li>
                                  <li><Link href="#">1 <i className="fa-solid fa-star"></i></Link></li>
                              </ul>
                          </div>
                          <div className="right">
                              <h5>Sort by</h5>
                              <div className="dropdown">
                                  <button className="dropdown-toggle" type="button" id="sort-filter" data-bs-toggle="dropdown" aria-expanded="false">
                                      Most Relevant
                                  </button>
                                  <ul className="dropdown-menu" aria-labelledby="sort-filter">
                                      <li><Link className="dropdown-item" href="#">Most Relevant</Link></li>
                                      <li><Link className="dropdown-item" href="#">Most Recent</Link></li>
                                      <li><Link className="dropdown-item" href="#">Highest Rated</Link></li>
                                      <li><Link className="dropdown-item" href="#">Lowest Rated</Link></li>
                                  </ul>
                              </div>
                          </div>
                      </div>

                      <div className="review-list-wrap">
                          <div className="review-box">
                              <h4>Great workour shirt</h4>
                              <h6>Scrawn44 | 6 days ago</h6>
                              <ul className="star-rating">
                                  <li><i className="fa-solid fa-star"></i></li>
                                  <li><i className="fa-solid fa-star"></i></li>
                                  <li><i className="fa-solid fa-star"></i></li>
                                  <li><i className="fa-solid fa-star"></i></li>
                                  <li><i className="fa-solid fa-star"></i></li>
                              </ul>
                              <p>Super comfortable and perfect for sweaty workouts. The fabric is lightweight, breathable, and moves with you — it wicks sweat fast so you stay dry and don’t feel weighed down mid-session. The shirt stretches well and doesn’t cling when you’re drenched, making it great for gym sessions, runs, or high-intensity training. Fit is true to size and feels good whether worn on its own or layered.</p>
                              <div className="info">
                                  <h6>Helpful</h6>
                                  <div className="form-check">
                                      <input type="radio" name="Helpful" id="h1" />
                                      <label htmlFor="h1"><i className="fa-regular fa-thumbs-up"></i>0</label>
                                  </div>
                                  <div className="form-check">
                                      <input type="radio" name="Helpful" id="h2" />
                                      <label htmlFor="h2"><i className="fa-regular fa-thumbs-down"></i>0</label>
                                  </div>
                              </div>
                          </div>
                      </div>

                      
                  </div>

                  <div className="col-12 banner-area">
                      <img src="/assets/images/product-banner1.jpg" alt="" />
                      <div className="content-area">
                          <h3>Great design and fit</h3>
                          <p>“It&apos;s incredibly lightweight and breathable, perfect for high intensity training. The fabric dries fast, stays comfortable, and never feels clingy.”</p>
                      </div>
                  </div>


              </div>

          </div>
      </section>

      <section className="related-product-section store-list-section section-padding-bottom">
          <div className="container">
              <div className="heading-area text-center"><h2>Related Products</h2></div>

              <div className="row product-list">
                  {[1, 2, 3, 4].map((item) => (
                  <div className="col-md-6 col-lg-4 col-xl-3" key={item}>
                      <div className="product-card">
                          <div className="product-image-area">
                              <img src="/assets/images/product1.jpg" alt="" />
                          </div>
                          <div className="product-content-area">
                              <h5>Belt System</h5>
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
          </div>
      </section>

      <Footer />
      <Script src="/assets/js/slick.min.js" strategy="lazyOnload" />
      <Script src="/assets/js/jquery.fancybox.min.js" strategy="lazyOnload" />
    </>
  );
}
