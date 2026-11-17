import Link from "next/link";

/** Static reviews block carried over from the template; redesigned later. */
export default function ProductReviews() {
    return (
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
    );
}
