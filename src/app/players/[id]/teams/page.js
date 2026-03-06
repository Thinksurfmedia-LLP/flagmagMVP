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

function TeamCard({ team }) {
    return (
        <div className="col-lg-6">
            <div className="team-card">
                <div className="left">
                    <div className="bg"><img src={team.logo || "/assets/images/teamlogo2.png"} alt="" /></div>
                    <img src={team.logo || "/assets/images/teamlogo2.png"} alt="" />
                </div>
                <div className="right">
                    <h5>{team.name}</h5>
                    <h6>{team.record}</h6>
                    <ul>
                        <li>PF - {team.pf}</li>
                        <li>PA - {team.pa}</li>
                        <li>DIFF - {team.diff}</li>
                    </ul>
                    <p>{team.season}</p>
                </div>
            </div>
        </div>
    );
}

export default async function PlayerTeamsPage({ params }) {
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
            <PlayerProfileHeader player={player} activeTab="teams" />

            <section className="leagues-section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="players-info-section">
                        <div className="row teams g-4">
                            {player.teams && player.teams.length > 0 ? player.teams.map((team, i) => (
                                <TeamCard key={i} team={team} />
                            )) : (
                                <div className="col-12 text-center py-4"><p>No team history yet.</p></div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}
