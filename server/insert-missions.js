const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'spy_database',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function insertMissions() {
  try {
    console.log('Starting mission insertion process...');
    
    // Clear existing missions first
    console.log('Clearing existing missions...');
    await pool.query('DELETE FROM missions');
    console.log('Existing missions cleared');
    
    // Define dummy missions
    const missions = [
      {
        id: 1,
        title: 'OPERATION SILENT SHADOW',
        mission_body: 'Infiltrate the downtown financial district and retrieve classified documents from the 23rd floor of the Meridian Tower. The building is under 24/7 surveillance. Use the maintenance access through the underground parking garage. Documents are located in a secure safe behind a false wall in the executive conference room. Extract without detection - any alarm will trigger immediate lockdown procedures.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 20 * 60 * 1000)
      },
      {
        id: 2,
        title: 'MISSION: PHANTOM PROTOCOL',
        mission_body: 'Establish surveillance on the waterfront warehouse district. Monitor all incoming and outgoing shipments for the next 72 hours. Focus on containers marked with red triangles. Document all license plates, delivery times, and personnel involved. The target organization operates under the guise of a legitimate import/export business. Maintain complete radio silence throughout the operation.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      },
      {
        id: 3,
        title: 'OPERATION CRIMSON TIDE',
        mission_body: 'Intercept a high-value target at the Grand Central Station during rush hour. The target will be wearing a blue overcoat and carrying a brown leather briefcase. Approach from the north entrance and follow at a safe distance. The target is expected to make contact with an unknown individual near the information desk at 5:47 PM. Record the exchange and identify the contact.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
      },
      {
        id: 4,
        title: 'MISSION: GHOST WALKER',
        mission_body: 'Conduct a dead drop retrieval at the abandoned subway station on 42nd Street. The package is hidden behind loose bricks in the northwest corner of the platform. Use the service entrance near the old ticket booth. The drop contains microfilm with coordinates for the next phase of operations. Verify the package integrity before extraction. If compromised, abort immediately and report.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      },
      {
        id: 5,
        title: 'OPERATION FROST WIND',
        mission_body: 'Establish a safe house in the residential district of Brooklyn Heights. The location must have clear sight lines to the harbor and multiple escape routes. Secure the premises with standard surveillance equipment and establish communication protocols. This will serve as the primary staging area for upcoming operations. Maintain civilian cover story as a freelance photographer.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
      },
      {
        id: 6,
        title: 'MISSION: THUNDER STRIKE',
        mission_body: 'Infiltrate the corporate headquarters of TechCorp Industries. The building has advanced security systems including motion sensors, thermal imaging, and biometric scanners. The objective is to access the mainframe in the basement server room and download all files from the "Project Phoenix" folder. Use the ventilation system access point on the roof. Time limit: 45 minutes from entry to exit.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) // 4 days from now
      },
      {
        id: 7,
        title: 'OPERATION NIGHT RAVEN',
        mission_body: 'Establish contact with a deep cover operative known as "The Librarian" at the public library on 5th Avenue. The operative will be reading "War and Peace" in the reading room. Approach with the code phrase "The weather is quite pleasant for this time of year." Receive the encrypted data packet and verify its authenticity using the provided verification key. If verification fails, terminate contact immediately.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000) // 6 days from now
      },
      {
        id: 8,
        title: 'MISSION: STORM CHASER',
        mission_body: 'Monitor and document all communications from the suspected safe house at 127 Maple Street. Use long-range surveillance equipment from the building across the street. Record all phone calls, radio transmissions, and any electronic signals. The target location is believed to be coordinating activities with foreign operatives. Maintain 24/7 surveillance for the next 48 hours. Report any suspicious activity immediately.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      },
      {
        id: 9,
        title: 'OPERATION IRON WING',
        mission_body: 'Recover a stolen prototype device from an abandoned factory in Queens. The device is approximately the size of a smartphone and emits a faint blue glow when activated. The factory is heavily booby-trapped with pressure plates and tripwires. Use extreme caution during approach and extraction. The device must be recovered intact - any damage will compromise its intelligence value.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      },
      {
        id: 10,
        title: 'MISSION: PHANTOM BLADE',
        mission_body: 'Establish a secure communication network using dead drops throughout Central Park. Set up 5 drop locations using standard protocols. Each location must be easily accessible but not suspicious to casual observers. Test the network by sending a test message through all nodes. Verify that each drop can receive and transmit encrypted data packets. This network will be used for future high-priority communications.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) // 4 days from now
      }
    ];
    
    console.log('Inserting missions...');
    for (const mission of missions) {
      try {
        await pool.query(
          `INSERT INTO missions (
            id, title, mission_body, completed, assigned_agent, 
            past_assigned_agents, assigned_now, mission_expires
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            mission.id,
            mission.title,
            mission.mission_body,
            mission.completed,
            mission.assigned_agent,
            mission.past_assigned_agents,
            mission.assigned_now,
            mission.mission_expires
          ]
        );
        console.log(`✓ Inserted mission: ${mission.title}`);
      } catch (err) {
        console.error(`✗ Error inserting mission ${mission.title}:`, err.message);
      }
    }
    
    // Verify the missions were inserted
    const result = await pool.query('SELECT COUNT(*) as mission_count FROM missions');
    console.log(`\nMission insertion completed! Total missions in database: ${result.rows[0].mission_count}`);
    
    // Show all missions
    const allMissions = await pool.query('SELECT id, title, completed, assigned_now FROM missions ORDER BY id');
    console.log('\nCurrent missions in database:');
    allMissions.rows.forEach(mission => {
      const status = mission.completed ? 'COMPLETED' : (mission.assigned_now ? 'ASSIGNED' : 'AVAILABLE');
      console.log(`  ${mission.id}. ${mission.title} - Status: ${status}`);
    });
    
  } catch (err) {
    console.error('Error during mission insertion:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

insertMissions();
