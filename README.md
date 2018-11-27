# Node-Red-Contrib-Blaulicht-SMS
Node-Red-Contrib-Blaulicht-SMS ist Node-Red Node der die [BlaulichtSMS API](https://github.com/blaulichtSMS/docs) verwendet.

Man kann damit, z.B. am Raspberry Pi, Alarme oder Infos empfangen und damit was auch immer anstellen :)  
Ein Beispiel wäre das Schalten von Monitoren über HDMI mit [Node-Red-Contrib-Cec](https://github.com/damoclark/node-red-contrib-cec).

#### Momentan ist ein Node implementiert:  
![BlaulichtSMS Dashboard Node](https://raw.githubusercontent.com/oe8chk/node-red-contrib-blaulicht-sms/develop/examples/blsms-dash-node1.png)
##### Am Output erwartet euch:
```
msg.payload: {
                 "customerId" : "123456",
                 "customerName" : "FF Test",
                 "username" : "einsatzmonitor",
                 "integrations" : [ ], // Liste an Integrationen
                 "alarms" : [ ], // Liste von AlarmData Elementen
                 "infos" : [ ] // List von AlarmData Elementen
             }
```
Nähere Infos unter [Dasboard Informationen](https://github.com/blaulichtSMS/docs/blob/master/dashboard_api_v1.md#dasboard-informationen).

#### Als Zugangsdaten werden die eures Einsatzmonitors verwendet:
![BlaulichtSMS Dashboard Node Config](https://raw.githubusercontent.com/oe8chk/node-red-contrib-blaulicht-sms/develop/examples/blsms-dash-node-config1.png)  
Das Abfrageintervall ist frei wählbar und der Node kann kontinuierlich oder nur nach Änderungen eine Message weitersenden.

# Installation
Download und Unzip vom Repository (noch nicht auf NPM)
```
cd $HOME/.node-red
npm install <dir>/node-red-contrib-blaulicht-sms/
```

# Geplant:
* Node für die Alarm API
