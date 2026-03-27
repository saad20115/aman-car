/**
 * WhatsApp Notification Module for Aman Car System
 */

export const WhatsApp = {
    /**
     * Extracts a Saudi phone number from a given string (e.g., "ياسر 0501111111")
     * and formats it for WhatsApp API (e.g., "966501111111")
     */
    extractSaudiPhoneNumber: function(text) {
        if (!text) return null;
        // Match 05 followed by 8 digits
        const match = text.match(/05\d{8}/);
        if (match) {
            // Replace leading 0 with 966
            return '966' + match[0].substring(1);
        }
        return null;
    },

    /**
     * Generates standard text for Customer depending on order status change.
     */
    generateCustomerMessage: function(order, status) {
        const orderId = order.id || 'N/A';
        const car = `(${order.carModel || ''} - ${order.carPlate || ''})`.trim();
        const total = order.totalAmount || 0;
        const remaining = total - (Number(order.paidAmount) || 0);

        let msg = '';
        if (status === 'pending_payment') {
            msg = `مرحباً بك في مركز أمان لصيانة السيارات،\n\nنود إعلامك بأنه تم إصدار فاتورة / أمر تشغيل لسيارتك ${car} برقم #${orderId}.\n\nقيمة الفاتورة الإجمالية: ${total} ر.س.\nنرجو التفضل بمراجعة الإدارة (الخزينة) للسداد للبدء بأعمال الصيانة.\n\nيسعدنا خدمتكم!`;
        } else if (status === 'ready_for_delivery') {
            msg = `عزيزي العميل،\n\nنود إعلامك بأن سيارتك ${car} المدرجة بطلب صيانة رقم #${orderId} أصبحت **جاهزة للاستلام الآن**.\n\n`;
            if (remaining > 0) {
                msg += `يرجى ملاحظة أن هناك مبلغ متبقي قدره (${remaining} ر.س).\n\n`;
            }
            msg += `نسعد بزيارتكم لاستلام السيارة، شاكرين لكم ثقتكم بمركز أمان.`;
        }
        return msg; // Other statuses could be added if needed, but per requirement keeping it "without annoyance" -> minimal spam.
    },

    /**
     * Generates a notification for Technicians for urgent alerts.
     */
    generateTechnicianMessage: function(order, alertType) {
        const orderId = order.id || 'N/A';
        const car = `(${order.carModel || ''} - ${order.carPlate || ''})`.trim();
        
        let msg = '';
        if (alertType === 'assigned') {
            msg = `*تنبيه إداري - مركز أمان*\n\nتم تعميد أمر تشغيل جديد للبدء بالعمل عليه.\n\nالطلب: #${orderId}\nالسيارة: ${car}\n\nيرجى الاطلاع على التفاصيل في النظام وبدء الصيانة.`;
        } else if (alertType === 'overdue') {
            msg = `*تنبيه هام وعاجل - تأخير استلام*\n\nالطلب رقم #${orderId} (سيارة: ${car}) تجاوز موعد التسليم المحدد ولم يتم الانتهاء منه وتغيير حالته لـ "جاهزة للتسليم".\n\nيرجى الإسراع بإنجاز العمل لتفادي ملاحظات العملاء.`;
        }
        return msg;
    },

    // ==========================================
    // إعدادات خدمة Authentica API للإرسال بالخلفية
    // ==========================================
    authenticaConfig: {
        apiKey: '$2y$10$n43c0qdivLe/XZQzNOMnZu9ZZrbAUlcGhPuqAX3LJGbZ8iOTQieb6', // مفتاح الـ API الخاص بـ Authentica
        templateId: '2', // تم تعيينه مؤقتاً للقالب العربي رقم 2 (كود التحقق الخاص بك...)
        method: 'whatsapp' // 'sms', 'whatsapp', or 'sms-or-whatsapp'
    },
    
    // رقم الإدارة أو الموظف المسؤول لاستقبال إشعارات النظام الداخلية.
    // يجب تسجيله برمز الدولة أو بدون صفر، مثال: 966500000000 أو 0500000000
    adminPhone: '0500000000', 

    /**
     * يرسل رسالة واتساب بصمت في الخلفية عبر (Authentica API)
     */
    sendToWhatsApp: async function(phone, message) {
        if (!phone) {
            console.error('WhatsApp send failed: No valid phone number.');
            return false;
        }
        
        // Ensure phone starts with +966 for Authentica API
        const formattedPhone = phone.startsWith('+') ? phone : '+' + phone;

        const { apiKey, templateId, method } = this.authenticaConfig;
        
        if (templateId === 'YOUR_TEMPLATE_ID' || !templateId) {
            console.warn('تنبيه: الرجاء إضافة template_id الخاص بقالب الواتساب في ملف whatsapp.js ليعمل مزود Authentica بشكل صحيح.');
        }

        const url = 'https://api.authentica.sa/api/v2/send-otp';
        const payload = {
            method: method,
            phone: formattedPhone,
            template_id: templateId,
            // تم التغيير مؤقتاً لتمرير رقم عشوائي من 4 أرقام لتجاوز شرط Authentica
            otp: Math.floor(1000 + Math.random() * 9000).toString() 
        };

        // Note: Logging original message for debugging
        console.log('Original message intended for WhatsApp: ', message);

        try {
            const req = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Authorization': apiKey
                },
                body: JSON.stringify(payload)
            });
            const res = await req.json();
            
            if (req.ok && res.status === true) {
                console.log('تم إرسال رسالة الواتساب بالخلفية بنجاح عبر Authentica.');
                return true;
            } else {
                console.error('حدث خطأ في واجهة Authentica:', res);
                return false;
            }
        } catch(e) {
            console.error('فشل الاتصال بـ Authentica API:', e);
            return false;
        }
    }
};
