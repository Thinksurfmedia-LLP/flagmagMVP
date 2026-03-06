import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PlayerProfileHeader from "@/components/PlayerProfileHeader";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import Award from "@/models/Award";

async function getData(id) {
    await dbConnect();
    const player = await Player.findById(id).lean();
    if (!player) return null;
    const awards = await Award.find({ player: id }).sort({ createdAt: -1 }).lean();
    return {
        player: JSON.parse(JSON.stringify(player)),
        awards: JSON.parse(JSON.stringify(awards)),
    };
}

export default async function PlayerAwardsPage({ params }) {
    const { id } = await params;
    const data = await getData(id);

    if (!data) {
        return (
            <><Header /><section className="innerpage-section type2"><div className="container py-5 text-center"><h1>Player not found</h1></div></section><Footer /></>
        );
    }

    const { player, awards } = data;

    return (
        <>
            <Header />
            <PlayerProfileHeader player={player} activeTab="awards" />

            <section className="leagues-section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="players-info-section">
                        <div className="row awards g-4">
                            {awards.length > 0 ? awards.map((award) => (
                                <div key={award._id} className="col-sm-6 col-md-4 col-lg-3">
                                    <div className="award-card">
                                        <div className="image-area">
                                            <img src={award.image || "/assets/images/award1.png"} alt="" />
                                        </div>
                                        <h5>{award.name}</h5>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-12 text-center py-4"><p>No awards yet.</p></div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}
