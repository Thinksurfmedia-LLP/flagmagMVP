"use client";

import { useState, Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookDemoModal from "@/components/BookDemoModal";
import ScrollToContent from "@/components/ScrollToContent";

export default function SponsorsPage() {
  const [demoOpen, setDemoOpen] = useState(false);

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
                  <h1>Our Sponsors</h1>
                  <p>Discover the amazing brands that support our community</p>
              </div>
          </div>
      </section>

      <section className="sponsors-logo-section section-padding" id="main-content">
          <div className="container">
              <div className="row g-4">
                  <div className="col-sm-6 col-lg-4 col-xl-3">
                      <div className="sponsor-logo-card">
                          <img src="/assets/images/sponsor-logo1.png" alt="" />
                      </div>
                  </div>
                  <div className="col-sm-6 col-lg-4 col-xl-3">
                      <div className="sponsor-logo-card">
                          <img src="/assets/images/sponsor-logo4.png" alt="" />
                      </div>
                  </div>
                  <div className="col-sm-6 col-lg-4 col-xl-3">
                      <div className="sponsor-logo-card">
                          <img src="/assets/images/sponsor-logo2.png" alt="" />
                      </div>
                  </div>
                  <div className="col-sm-6 col-lg-4 col-xl-3">
                      <div className="sponsor-logo-card">
                          <img src="/assets/images/sponsor-logo3.png" alt="" />
                      </div>
                  </div>
              </div>
          </div>
      </section>

      <section className="knowus-section section-padding">
          <div className="container">
              <div className="heading">
                  <h2>Get to know us</h2>
                  <p>Since 2015, we have been leading the charge in advocating for the inclusion of our sport in the Olympics. As pioneers, we have organized and hosted the largest flag football tournaments worldwide, showcasing our commitment to the growth and popularity of the sport.</p>

                  <p>With a massive following, we are proud to be the most influential brand in the field. Our dedication and passion have paved the way for the recognition and success of flag football on a global scale. Join us in our journey to make history and bring the sport to the Olympic stage. Together, we can inspire athletes, fans, and future generations to embrace the spirit of competition and unity.</p>
              </div>

              <div className="row gy-4">
                  <div className="col-sm-6 col-lg-4">
                      <div className="know-div">
                          <img src="/assets/images/know1.jpg" alt="" />
                          <h4>TOURNAMENTS</h4>
                          <p>Our 2023 Flag Football World Championship in Tampa was a resounding success, setting new milestones for the sport. With over 950 participating teams, the event spanned four adrenaline-packed days, showcasing talent across 40 diverse divisions with teams from all over the world. </p>
                      </div>
                  </div>
                  <div className="col-sm-6 col-lg-4">
                      <div className="know-div">
                          <img src="/assets/images/know1.jpg" alt="" />
                          <h4>TOURNAMENTS</h4>
                          <p>Our 2023 Flag Football World Championship in Tampa was a resounding success, setting new milestones for the sport. With over 950 participating teams, the event spanned four adrenaline-packed days, showcasing talent across 40 diverse divisions with teams from all over the world. </p>
                      </div>
                  </div>
                  <div className="col-sm-6 col-lg-4">
                      <div className="know-div">
                          <img src="/assets/images/know1.jpg" alt="" />
                          <h4>TOURNAMENTS</h4>
                          <p>Our 2023 Flag Football World Championship in Tampa was a resounding success, setting new milestones for the sport. With over 950 participating teams, the event spanned four adrenaline-packed days, showcasing talent across 40 diverse divisions with teams from all over the world. </p>
                      </div>
                  </div>
              </div>

              <div className="row know-number-area">
                  <div className="col-12">
                      <h3>NUMBERS DON&apos;T LIE</h3>
                  </div>
                  <div className="col-sm-6 col-lg-3">
                      <h4>126</h4>
                      <h6>EVENTS RUN</h6>
                  </div>
                  <div className="col-sm-6 col-lg-3">
                      <h4>8,267</h4>
                      <h6>TOTAL TEAMS</h6>
                  </div>
                  <div className="col-sm-6 col-lg-3">
                      <h4>102,459</h4>
                      <h6>TOTAL ATHLETES</h6>
                  </div>
                  <div className="col-sm-6 col-lg-3">
                      <h4>389,456</h4>
                      <h6>EVENT PARTICIPANTS & FANS</h6>
                  </div>
              </div>

          </div>
      </section>

      <section className="sp-assets-section section-padding">
          <div className="container">
                <div className="heading">
                  <h2>Sponsorship Assets</h2>
                  <p>With a massive grass roots ecosystem complimented by a major digital following, we have unlimited sponsorship opportunities to match your brand goals!</p>
              </div>

              <div className="row gy-4">
                  <div className="col-xl-4">
                      <ul className="list2">
                          <li>Presenting & Title Opportunities</li>
                          <li>Onsite Activation</li>
                          <li>Digital & Social Media</li>
                          <li>Content Creation</li>
                          <li>Merchandising</li>
                          <li>Custom Opportunities</li>
                      </ul>
                  </div>
                  <div className="col-xl-4">
                      <img src="/assets/images/sp-assets.png" alt="" />
                  </div>
                  <div className="col-xl-4">
                      <ul className="list2">
                          <li>Presenting & Title Opportunities</li>
                          <li>Onsite Activation</li>
                          <li>Digital & Social Media</li>
                          <li>Content Creation</li>
                          <li>Merchandising</li>
                          <li>Custom Opportunities</li>
                      </ul>
                  </div>
              </div>

          </div>
      </section>

      <section className="interest-form section-padding">
          <div className="container">
              <div className="heading">
                  <h2>Join Our Sponsorship</h2>
                  <p>We are always looking for new partners to join us on our mission to grow the sport of flag football. If you are interested in becoming a sponsor, please fill out the form below and we will be in touch with you shortly.</p>
              </div>

              <form action="#" className="sponsor-form" onSubmit={(e) => e.preventDefault()}>
                  <div className="row g-4">
                      <div className="col-sm-6 col-lg-6">
                          <div className="form-group">
                              <label htmlFor="">First Name</label>
                              <input type="text" className="form-control" required />
                          </div>
                      </div>
                      <div className="col-sm-6 col-lg-6">
                          <div className="form-group">
                              <label htmlFor="">Email</label>
                              <input type="email" className="form-control" required />
                          </div>
                      </div>
                      <div className="col-sm-6 col-lg-6">
                          <div className="form-group">
                              <label htmlFor="">Phone Number</label>
                              <input type="text" className="form-control" required />
                          </div>
                      </div>
                      <div className="col-sm-6 col-lg-6">
                          <div className="form-group">
                              <label htmlFor="">Company Name</label>
                              <input type="text" className="form-control" required />
                          </div>
                      </div>
                      <div className="col-sm-6 col-lg-6">
                          <div className="form-group">
                              <label htmlFor="">Company Website</label>
                              <input type="text" className="form-control" required />
                          </div>
                      </div>
                      <div className="col-sm-6 col-lg-6">
                          <div className="form-group">
                              <label htmlFor="">Zipcode</label>
                              <input type="text" className="form-control" required />
                          </div>
                      </div>
                      <div className="col-12">
                          <div className="form-group">
                              <label htmlFor="">What type of budget range do you have at your disposal for sponsorable assets?</label>
                              <input type="text" className="form-control" required />
                          </div>
                      </div>

                      <div className="col-12">
                          <div className="form-group">
                              <label htmlFor="">What type of budget range do you have at your disposal for sponsor able assets?</label>
                              <input type="text" className="form-control" required />
                          </div>
                      </div>
                      <div className="col-12 text-center">
                          <button type="submit" className="btn btn-primary">Join Now</button>
                      </div>
                  </div>
              </form>

          </div>
      </section>

      <Footer />
    </>
  );
}
