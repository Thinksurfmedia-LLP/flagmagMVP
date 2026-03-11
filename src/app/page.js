import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <Header variant="homepage" />

      <section className="banner-section">
        <div className="container">
          <div className="banner-area">
            <h1>Run Smarter Sports Leagues<br /> with Automated Scoring, Stats &amp; Insights</h1>
            <h5>A single platform to manage games, track player &amp; team performance, and maintain accurate records across multiple sports.</h5>
            <p>Built for league organizers, tournament directors, academies, and officials who want control, accuracy, and scalability.</p>
            <Link href="#" className="btn btn-primary">See How It Works</Link>
          </div>
        </div>
      </section>

      <section className="first-section section-padding">
        <div className="container">
          <div className="heading-area">
            <h2>Built for People Who Run the Game</h2>
            <h4>— Not Just Watch It</h4>
          </div>

          <div className="row justify-content-center">
            <div className="col-xxl-10">
              <div className="row g-4">
                <div className="col-lg-6">
                  <div className="card build-card">
                    <div className="card-body">
                      <img src="/assets/images/b1.png" alt="" />
                      <h4>League Owners &amp; Organizers</h4>
                      <p>Stop chasing spreadsheets, WhatsApp updates, and manual scorekeeping. Manage seasons, standings, and stats from one dashboard.</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="card build-card">
                    <div className="card-body">
                      <img src="/assets/images/b2.png" alt="" />
                      <h4>Tournament Directors</h4>
                      <p>Create brackets, record match results, and publish standings instantly — without operational breakdowns during game days.</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="card build-card">
                    <div className="card-body">
                      <img src="/assets/images/b3.png" alt="" />
                      <h4>Clubs &amp; Academies</h4>
                      <p>Track player development, performance history, and match data across seasons to make better training and selection decisions.</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="card build-card">
                    <div className="card-body">
                      <img src="/assets/images/b4.png" alt="" />
                      <h4>Referees &amp; Stat Keepers</h4>
                      <p>Record scores and stats accurately, in real time, with minimal effort and zero confusion.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center bottom-text">
            <p><i>If accuracy, structure, and accountability matter — this platform is for you.</i></p>
          </div>
        </div>
      </section>

      <section className="everything-section section-padding">
        <div className="container">
          <div className="heading-area">
            <h2>Everything You Need to Run a League</h2>
            <h4>— Nothing You Don&apos;t</h4>
          </div>

          <div className="row justify-content-center align-items-center g-5">
            <div className="col-lg-6">
              <div className="content-area">
                <div className="accordion" id="accordionExample">
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">Live Scoring &amp; Match Control</button>
                    </h2>
                    <div id="collapseOne" className="accordion-collapse collapse show" data-bs-parent="#accordionExample">
                      <div className="accordion-body">
                        <p>Capture match results quickly and accurately with a structured scoring system built for real game conditions.</p>
                        <ul className="list2">
                          <li>Eliminate scoring disputes</li>
                          <li>Reduce manual errors</li>
                          <li>Maintain match integrity</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">Player &amp; Team Statistics</button>
                    </h2>
                    <div id="collapseTwo" className="accordion-collapse collapse" data-bs-parent="#accordionExample">
                      <div className="accordion-body">
                        <p>Capture match results quickly and accurately with a structured scoring system built for real game conditions.</p>
                        <ul className="list2">
                          <li>Eliminate scoring disputes</li>
                          <li>Reduce manual errors</li>
                          <li>Maintain match integrity</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">League &amp; Tournament Management</button>
                    </h2>
                    <div id="collapseThree" className="accordion-collapse collapse" data-bs-parent="#accordionExample">
                      <div className="accordion-body">
                        <p>Capture match results quickly and accurately with a structured scoring system built for real game conditions.</p>
                        <ul className="list2">
                          <li>Eliminate scoring disputes</li>
                          <li>Reduce manual errors</li>
                          <li>Maintain match integrity</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFour" aria-expanded="false" aria-controls="collapseFour">One Platform. Multiple Sports</button>
                    </h2>
                    <div id="collapseFour" className="accordion-collapse collapse" data-bs-parent="#accordionExample">
                      <div className="accordion-body">
                        <p>Capture match results quickly and accurately with a structured scoring system built for real game conditions.</p>
                        <ul className="list2">
                          <li>Eliminate scoring disputes</li>
                          <li>Reduce manual errors</li>
                          <li>Maintain match integrity</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="image-area">
                <img src="/assets/images/fg1.png" alt="" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="platform-section section-padding">
        <div className="container">
          <div className="heading-area">
            <h2>One Platform Built to Scale Across Sports</h2>
            <p>Whether you manage one sport today or plan to expand tomorrow, the platform is designed to adapt without rebuilding systems from scratch.</p>
          </div>

          <div className="content-area">
            <div className="item">
              <img src="/assets/images/f1.png" alt="" />
              <h5>Flag Football</h5>
            </div>
            <div className="item">
              <img src="/assets/images/f2.png" alt="" />
              <h5>Soccer</h5>
            </div>
            <div className="item">
              <img src="/assets/images/f3.png" alt="" />
              <h5>Basketball</h5>
            </div>
            <div className="item">
              <img src="/assets/images/f4.png" alt="" />
              <h5>Pickleball</h5>
            </div>
            <div className="item">
              <h5>More coming soon</h5>
            </div>
          </div>

          <div className="text-center button-area">
            <Link href="#" className="btn btn-primary btn-with-arrow">BOOK a Demo <span><img src="/assets/images/btn-arrow.png" alt="" /></span></Link>
          </div>
        </div>

        <div className="custom-shape-top">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
            <path fill="#351d1b" d="M0,0 C480,100 960,100 1440,0 L1440,100 L0,100 Z"></path>
          </svg>
        </div>
      </section>

      <section className="worked-section section-padding">
        <div className="container">
          <div className="heading-area">
            <h2>Simple to Start. Powerful as You Grow.</h2>
          </div>

          <div className="work-wrapper">
            <div className="row g-5 align-items-center">
              <div className="col-md-6 col-xl-4">
                <div className="image-area" data-aos="fade-up" data-aos-anchor-placement="top-center" data-aos-duration="1000">
                  <img src="/assets/images/w1.jpg" alt="" />
                </div>
              </div>
              <div className="col-md-6 col-xl-8">
                <div className="content-area">
                  <h2>Set Up Your League or <br />Tournament</h2>
                  <p>Create teams, schedules, rules, and seasons in minutes.</p>
                </div>
              </div>
            </div>

            <div className="row g-5 align-items-center">
              <div className="col-md-6 col-xl-4">
                <div className="image-area" data-aos="fade-up" data-aos-anchor-placement="top-center" data-aos-duration="1000">
                  <img src="/assets/images/w2.jpg" alt="" />
                </div>
              </div>
              <div className="col-md-6 col-xl-8">
                <div className="content-area">
                  <h2>Capture <br />Scores &amp; Stats</h2>
                  <p>Record match data through a structured, easy-to-use interface designed for real-world game flow.</p>
                </div>
              </div>
            </div>

            <div className="row g-5 align-items-center">
              <div className="col-md-6 col-xl-4">
                <div className="image-area" data-aos="fade-up" data-aos-anchor-placement="top-center" data-aos-duration="1000">
                  <img src="/assets/images/w3.jpg" alt="" />
                </div>
              </div>
              <div className="col-md-6 col-xl-8">
                <div className="content-area">
                  <h2>Track Performance &amp; <br />History</h2>
                  <p>View standings, player stats, and historical records instantly — all in one place.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="build-section section-padding">
        <div className="custom-shape-top">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
            <path d="M0,60 C480,0 960,0 1440,60 L1440,0 L0,0 Z"></path>
          </svg>
        </div>
        <div className="spacer"></div>

        <div className="container">
          <div className="row">
            <div className="col-lg-6">
              <div className="content-area">
                <h2>Built for Reliability, Accuracy &amp; Long-Term Use</h2>
                <h4>Supporting Statements</h4>

                <div className="list-area">
                  <div className="item active">
                    <img src="/assets/images/build1.png" alt="" />
                    <span>Trusted by growing leagues and academies</span>
                  </div>
                  <div className="item">
                    <img src="/assets/images/build2.png" alt="" />
                    <span>Designed for high-volume matches and seasons</span>
                  </div>
                  <div className="item">
                    <img src="/assets/images/build3.png" alt="" />
                    <span>Structured for data accuracy and consistency</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xxl-5 col-xl-6">
              <div className="image-area">
                <div className="build-bg"><img src="/assets/images/build-img-bg.png" alt="" /></div>
                <img src="/assets/images/build-img1.png" alt="" />
              </div>
            </div>
          </div>

          <div className="row align-items-center justify-content-center video-wrapper">
            <div className="col-xxl-11">
              <div className="video-area">
                <img src="/assets/images/video.png" alt="" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="testimonial-section">
        <div className="container">
          <div className="heading-area">
            <h2>Why League Directors Don&apos;t Go Back After<br /> Using FLAGMAG</h2>
            <p>Real experiences from league directors who simplified scheduling, reduced admin chaos, and ran smoother seasons.</p>
          </div>

          <div className="testimonial-slider">
            <TestimonialCarousel>
              <div className="item testimonial-area">
                <div className="card">
                  <div className="card-header">
                    <h4>Operations Relief</h4>
                    <img src="/assets/images/star.png" alt="" />
                  </div>
                  <div className="card-body">
                    <p>Before FLAGMAG, everything lived in spreadsheets and WhatsApp threads. Scheduling changes, registrations, payments—nothing was in one place. After switching, our admin load dropped massively. We finally run the league instead of chasing it every day.</p>
                  </div>
                </div>
              </div>
              <div className="item testimonial-area">
                <div className="card">
                  <div className="card-header">
                    <h4>Operations Relief</h4>
                    <img src="/assets/images/star.png" alt="" />
                  </div>
                  <div className="card-body">
                    <p>Before FLAGMAG, everything lived in spreadsheets and WhatsApp threads. Scheduling changes, registrations, payments—nothing was in one place. </p>
                  </div>
                </div>
              </div>
              <div className="item testimonial-area">
                <div className="card">
                  <div className="card-header">
                    <h4>Operations Relief</h4>
                    <img src="/assets/images/star.png" alt="" />
                  </div>
                  <div className="card-body">
                    <div className="video-area">
                      <img src="/assets/images/testi-video.png" alt="" />
                    </div>
                  </div>
                </div>
              </div>
            </TestimonialCarousel>
          </div>
        </div>
      </section>

      <section className="how-it-work-section section-padding-top">
        <div className="container">
          <div className="heading-area">
            <h2>Stop Managing Games the Hard Way</h2>
            <p>If your league relies on manual work, scattered tools, or unreliable stats, it&apos;s time to upgrade to a system built for control and scale.</p>
          </div>

          <div className="button-area">
            <Link href="#" className="btn btn-info-primary">See How It Works</Link>
            <Link href="#" className="btn btn-primary btn-with-arrow">Talk to Our Team <span><img src="/assets/images/btn-arrow.png" alt="" /></span></Link>
          </div>

          <div className="image-area">
            <img src="/assets/images/ftr-img.png" alt="" />
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
