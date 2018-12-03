/*
 * src:
 * https://github.com/blaulichtSMS/docs/blob/master/dashboard_api_v1.md
 * https://github.com/node-red/node-red-nodes/blob/master/io/snmp/snmp.html
 * https://nodered.org/docs/creating-nodes/status
 */
module.exports = function (RED) {

    /**
     * @param config
     */
    function BlSmsNodeAlert(config) {
        RED.nodes.createNode(this, config);

        this.host = "https://api.blaulichtsms.net/blaulicht/";
        this.login = "api/alarm/v1/trigger";
        this.kid = config.kid;
        this.user = config.user;
        this.pass = config.password;
        this.hideTriggerDetails = config.hideTriggerDetails;

        let Client = require('node-rest-client').Client;
        this.client = new Client();

        var node = this;

        node.on('input', function (msg) {

            apiEndpoint = node.host + node.login;
            let args = {
                data: {

                    username: node.user, // string - verpflichtend - Benutzername
                    password: node.pass, // string - verpflichtend - Passwort
                    customerId: node.kid, // string - verpflichtend - Kundennummer
                    type: "info", // alarm | info - verpflichtend - Der Alarmtyp
                    hideTriggerDetails: node.hideTriggerDetails, // boolean - optional - Alarmgeberdetails nicht mitsenden
                    alarmText: "", // string - optional - Der Alarmtext
                    indexNumber: 0, // integer- optional - Die Index Nummer dient zur Identifikation von zwei identen Alarmen. Achtung: Falls zwei oder mehr Alarme mit der selben Index Nummer ausgelöst werden, werden die späteren ignoriert.
                    needsAcknowledgement: false, //boolean - verpflichtend - Antwortfunktion
                    startDate: "2017-01-27T14:49:52.000Z",// string - optional - Das Startdatum für den Alarm, falls der Alarm in der Zukunft starten soll.
                    // Der Timestamp muss im UTC Format übertragen werden z.B. :"2017-01-27T14:49:52.000Z"
                    duration: 0, // integer - conditional - Dauer der Antwortfunktion in Minuten
                    recipientConfirmation: false, // boolean - optional - SMS Empfangsbestätigung ein- bzw. ausschalten (kostenpflichtig)
                    recipientConfirmationTarget: "", // string - optional - Empfänger für Report zu Empfangsbestätigungen
                    template: "",// string - optional - Alarmtextcode z.b. "A1"
                    groupCodes: [], // list of strings - optional - Alarmgruppen z.b. ["G1"]
                    additionalMsisdns: [], // list of strings - optional - Nummern die zusätzlich alarmiert werden sollen z.B.: ["+4366412345678", "+4367612345678"]
                    coordinates: {
                        "lat": 48.205587,
                        "lon": 16.342917
                    } // object of Type Coordinate - optional - Alarmkoordinaten

                },
                headers: {"Content-Type": "application/json"}
            };

            node.client.post(apiEndpoint, args, function (data, response) {
                if (data.error === null) {
                    node.sessionKey = data.sessionId;
                    node.status({fill: "green", shape: "dot", text: "session OK"});
                } else {
                    if (data.error) {
                        node.status({fill: "red", shape: "dot", text: "session Err: " + data.error});
                    } else {
                        node.status({fill: "red", shape: "dot", text: "connection Err: " + response.statusCode});
                    }
                    msg.payload = data;
                    node.send(msg);
                }
            });

        });
    }

    RED.nodes.registerType("bl-sms-alert", BlSmsNodeAlert);
};
