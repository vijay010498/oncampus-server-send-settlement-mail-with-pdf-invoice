const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgmail = require('@sendgrid/mail');
const PDFDocument = require("pdfkit");
const moment = require('moment');
const momentTimeZone = require('moment-timezone');
const {Storage} = require('@google-cloud/storage');
const storage = new Storage ({projectId: "eatitv2-75508"});
const bucket = storage.bucket('eatitv2-75508-restaurant-settlements-invoice');
const folderName = "RFC-SSN";

admin.initializeApp();
const SETTLEMENT_DB = functions.config().database.settlementdb;
const API_KEY = functions.config().sendgrid.key;
const TEMPLATE_SETTLEMENT = functions.config().sendgrid.templatesettlementpartner;
const PARTNER_MAIL_restauranta = "svijayr007@gmail.com";
sgmail.setApiKey(API_KEY);
const runTimeOpts = {
    timeoutSeconds: 300,
    memory: '1GB'
}

//Settlement Mail 1.0 
//variables--
//settlementDate
//partnerName
//settlementAmount
//totalOrders
//settlementStatus
//settlementId
//orders
exports.sendSettlementMailForrestauranta = 
functions
        .runWith(runTimeOpts)
        .database.instance(SETTLEMENT_DB).ref('settlements/restauranta/{settlementId}')
        .onWrite(async (change, context) =>
        {
                const snapshot = change.after;
                const settlement = snapshot.val();
                const settlementId = context.params.settlementId;
                const settlementDate = moment(settlement.settlementDate).format("DD-MM-YYYY");
                const settlementAmount = settlement.amount;
                const orders = settlement.orders;
                const settlementStatus = settlement.settlementStatus;
                const totalOrders = settlement.totalOrders;
                const partnerName = "RFC Owner";

                //Logging
                console.log('settlementId',settlementId);
                console.log('settlementDate',settlementDate);
                console.log('settlementAmount',settlementAmount);
                //console.log('orders',orders);
                console.log('settlementStatus',settlementStatus);
                console.log('totalOrders',totalOrders);
                console.log('partnerName',partnerName);
                console.log('partnerEmail',PARTNER_MAIL_restauranta);

                const invoice = {
                    ownerName:"RFC Owner",
                    restaurantName:"RFC Food Court",
                    ownerPhone:"+91999999999",
                    ownerEmail:"svijayr007@gmail.com",
                    restaurantCampus:"SSN College of Engineering",
                    settlementId:context.params.settlementId,
                    amount:settlementAmount,
                    orders:orders,
                    settlementDate:settlementDate,
                    settlementStatus:settlementStatus,
                    totalOrders:totalOrders
                };
                return createInvoice(invoice,settlement,settlementId
                    ,settlementDate,settlementAmount,
                    orders,settlementStatus,totalOrders,partnerName);

        });


        //Generate Pdf Functions
        function createInvoice(invoice,settlement,settlementId
            ,settlementDate,settlementAmount,
            orders,settlementStatus,totalOrders,partnerName) 
            {
                    let doc = new PDFDocument({ size: "A4", margin: 50 });
                    generateHeader(doc);
                    generateCustomerInformation(doc, invoice);
                    generateInvoiceTable(doc, invoice);
                    var data = new Date();
                    var timeStamp = data.getTime();
                    const dateAppend = momentTimeZone.tz(timeStamp, "Asia/Kolkata").format("DD-MM-YY hh:mm:ss")
                    const filename = folderName + "/" + dateAppend + "$" + settlementId + '.pdf';
                    const file = bucket.file(filename);
                    const bucketWriteFileStream = file.createWriteStream();
                    doc.pipe(bucketWriteFileStream);
                    doc.end();
                    bucketWriteFileStream.on('finish', function(response)
                {
                    console.log('PDF UPLOADED:)',response);
                    return sendMailWithInvoice(filename,settlement,settlementId
                        ,settlementDate,settlementAmount,
                        orders,settlementStatus,totalOrders,partnerName)

                });
                bucketWriteFileStream.on("error", function (err) 
                {
                      console.error(err);
                });
          }

          async function sendMailWithInvoice(filename,settlement,settlementId
            ,settlementDate,settlementAmount,
            orders,settlementStatus,totalOrders,partnerName)
            {
                    var data = new Date();
                    var timeStamp = data.getTime();
                    const dateAppend = momentTimeZone.tz(timeStamp, "Asia/Kolkata").format("DD-MM-YY hh:mm:ss")
                const file = bucket.file(filename);
                file.download(async function(error, contents){
                    if(error)
                    {
                        console.log("PDF DOWNLOAD", error);
                    }
                      else
                      {
                            console.log("PDF DOWNLOADED",contents.toString("base64"));
                            const pdfInvoice = contents.toString("base64");
                            const msg = {
                                to:{
                                    email:PARTNER_MAIL_restauranta,
                                    name:partnerName
                                },
                                from:{
                                    email:'settlements@mails.oncampus.in',
                                    name:'oncampus.in'
                                },
                                reply_to:{
                                    email:'contact@oncampus.in',
                                    name:'onCampus.in'
                                },
                                click_tracking:{
                                    enable:true,
                                    enable_text:true
                    
                                },
                                open_tracking:{
                                    enable:true
                    
                                },
                                templateId: TEMPLATE_SETTLEMENT,
                                dynamic_template_data:{
                                settlementDate:settlementDate,
                                partnerName:partnerName,
                                settlementAmount:settlementAmount,
                                totalOrders:totalOrders,
                                settlementStatus:settlementStatus,
                                settlementId:settlementId,
                                orders:orders
                                },
                                attachments:[
                                    {
                                    content:pdfInvoice,
                                    filename: dateAppend + settlementId,
                                    type: "application/pdf",
                                    disposition: "attachment"
                                    }
                                  ]
                            };
                            return await sgmail.send(msg)
                                    .then(() =>{
                                        console.log('Settlement Email Sent Successfully');
                                    }).catch((error) =>{
                                        console.log('Email Sending Error',error);
                                    });

                      }
                });

            }
          



          //Pdf Functions
           function generateHeader(doc) 
                  {
                        doc
                          .image("./onCampus-logo.jpg", 50, 45, { width: 50 })
                          .fillColor("#005048")
                          .fontSize(20)
                          .text("oncampus.", 110, 57)
                          .fontSize(10)
                          .text("oncampus Pvt Ltd.", 200, 50, { align: "right" })
                          .text("365-A Suramangalam main road,", 200, 65, { align: "right" })
                          .text("Salem, TN, 636005", 200, 80, { align: "right" })
                          .moveDown();
                  }
          
          function generateCustomerInformation(doc, invoice) {
            doc
              .fillColor("black")
              .fontSize(20)
              .text("Settlement Invoice", 50, 160,{ align: "center" });
          
            generateHr(doc, 185);
          
            const customerInformationTop = 200;
          
            doc
              .fontSize(10)
              .font("Helvetica-Bold")
              .fillColor("black")
              .text("Settlement Id:", 50, customerInformationTop)
              .font("Helvetica-Bold")
              .fillColor("red")
              .text(invoice.settlementId + ".", 150, customerInformationTop)
              .font("Helvetica-Bold")
              .fillColor("black")
              .text("Settlement Date:", 50, customerInformationTop + 15)
              .fillColor("orange")
              .text(invoice.settlementDate+ ".", 150, customerInformationTop + 15)
              .fillColor("black")
              .text("Settlement Amount", 50, customerInformationTop + 30)
              .font("Helvetica-Bold")
              .fillColor("green")
              .text(
                "Rs."+(invoice.amount) + ".",
                150,
                customerInformationTop + 30
              )
              .font("Helvetica-Bold")
              .fillColor("black")
              .text("Total Orders", 50, customerInformationTop + 45)
              .fillColor("purple")
              .text(
               (invoice.totalOrders) + ".",
                150,
                customerInformationTop + 45
              )
          
              .font("Helvetica-Bold")
              .fillColor("black")
              .text("Settlement Status", 50, customerInformationTop + 59)
              .fillColor("green")
              .text(
               (invoice.settlementStatus) + ".",
                150,
                customerInformationTop + 59
              )
          
          
              .font("Helvetica-Bold")
              .fillColor("black")
              .text(invoice.ownerName + ".", 350, customerInformationTop)
              .font("Helvetica")
              .text(invoice.restaurantName + ".", 350, customerInformationTop + 15)
              .text(
                invoice.ownerPhone + ".",
                350,
                customerInformationTop + 30
              )
              .text(
                invoice.ownerEmail + ".",
                350,
                customerInformationTop + 45
              )
              .text(
                invoice.restaurantCampus + ".",
                350,
                customerInformationTop + 60
              )
              .moveDown();
          
            generateHr(doc, 270);
          }
          
          function generateInvoiceTable(doc, invoice) {
            let i;
            const invoiceTableTop = 330;
            doc.font("Helvetica-Bold");
            generateTableRowHeading(
              doc,
              invoiceTableTop,
              "Order Id",
              "Type",
              "Value",
              "-%",
              "-Amount",
              "Delivery ",
              "Packing ",
              "Settlement"
            );
            generateHr(doc, invoiceTableTop + 20);
            doc.font("Helvetica");
          
          
            
            
            var json_orders = invoice.orders;
            var k = 0;
            for(i in json_orders){
              const order = json_orders[i];
              const position = invoiceTableTop + (k+ 1) * 30;
              if(json_orders[i].pickup == true)
                var type = "Pickup";
              else
                var type  = "Delivery";
              generateTableRow(
                doc,
                position,
                i,
                type,
                json_orders[i].totalPayment,
                json_orders[i].onCampusCommissionPercentage,
                json_orders[i].onCampusCommissionAmount,
                json_orders[i].deliveryCharges,
                json_orders[i].packingCharges,
                json_orders[i].payToRestaurantAfterCommissionAmount,
              );
              k++;
          
          
              generateHr(doc, position + 20);
            }
          
          
          }
          function generateTableRowHeading(
            doc,
            y,
            orderId,
            orderType,
            orderValue,
            commissionPercentage,
            commissionAmount,
            deliveryCharges,
            packingCharges,
            settlementAmount
            
          ) {
            doc
              .fontSize(10)
              .fillColor("black")
              .text(orderId, 50, y)  
              .fillColor("blue")
              .text(orderType, 180, y)
              .fillColor("green")
              .text(orderValue, 240, y)
              .fillColor("red")
              .text(commissionPercentage, 290, y)
              .text(commissionAmount, 340, y)
              .fillColor("green")
              .text(deliveryCharges, 390, y)
              .text(packingCharges, 440, y)
              .text(settlementAmount, 490, y);
          }
          
          function generateTableRow(
            doc,
            y,
            orderId,
            orderType,
            orderValue,
            commissionPercentage,
            commissionAmount,
            deliveryCharges,
            packingCharges,
            settlementAmount
            
          ) {
            doc
              .fontSize(10)
              .fillColor("black")
              .text(orderId, 50, y)  
              .fillColor("blue")
              .text(orderType, 180, y)
              .fillColor("green")
              .text("Rs."+orderValue, 240, y)
              .fillColor("red")
              .text("-"+commissionPercentage + "%", 290, y)
              .text("-Rs."+commissionAmount, 340, y)
              .fillColor("green")
              .text("Rs."+deliveryCharges, 390, y)
              .text("Rs."+packingCharges, 440, y)
              .text("Rs."+settlementAmount, 490, y);
          }
          
          function generateHr(doc, y) {
            doc
              .strokeColor("#aaaaaa")
              .lineWidth(1)
              .moveTo(50, y)
              .lineTo(550, y)
              .stroke();
          }
          
        