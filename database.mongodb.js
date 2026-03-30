use('shield_db');
// Parang eto yung php to sql commands na tinuturo ni sir rj. so sa top right may > arrow icon ayon yung pang start/run.


//Sample command to get all users na may province na "Bulacan"
const bulacanUsers = db.getCollection('users').find({
  "location.province": "Bulacan"
}).toArray();


console.log("Users found in Bulacan: ", bulacanUsers);