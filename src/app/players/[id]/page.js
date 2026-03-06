import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PlayerProfileHeader from "@/components/PlayerProfileHeader";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";

async function getPlayer(id) {
    await dbConnect();
    const player = await Player.findById(id).lean();
    if (!player) return null;
    return JSON.parse(JSON.stringify(player));
}

export default async function PlayerOverviewPage({ params }) {
    const { id } = await params;
    const player = await getPlayer(id);

    if (!player) {
        return (
            <><Header /><section className="innerpage-section type2"><div className="container py-5 text-center"><h1>Player not found</h1></div></section><Footer /></>
        );
    }

    return (
        <>
            <Header />
            <PlayerProfileHeader player={player} activeTab="overview" />

            <section className="leagues-section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="players-info-section">
                        <div className="row overview">
                            {[
                                { label: "Overall", value: player.overallRating },
                                { label: "Defense", value: player.defenseRating },
                                { label: "Quarter Back", value: player.quarterbackRating },
                                { label: "Wide Receiver", value: player.wideReceiverRating },
                            ].map((stat, i) => (
                                <div key={i} className="col-sm-6 col-lg-4 col-xl-3 mb-4">
                                    <div className="card">
                                        <div className="card-body">
                                            <h5>{stat.label}</h5>
                                            <div className="box">
                                                <h6>{stat.value}</h6>
                                                <p>Rating</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}
