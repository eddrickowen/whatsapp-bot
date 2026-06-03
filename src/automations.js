const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Evaluates all active automations against an incoming message.
 * Called from whatsapp.js on every new inbound message.
 */
async function evaluateAutomations(client, msg) {
    try {
        const automations = await prisma.automation.findMany({
            where: { isActive: true }
        });

        for (const automation of automations) {
            const triggered = await checkTrigger(automation, msg);
            if (!triggered) continue;

            console.log(`[Automation] "${automation.name}" triggered by ${msg.from}`);
            await executeSteps(client, msg, automation.steps);

            await prisma.automation.update({
                where: { id: automation.id },
                data: {
                    executionCount: { increment: 1 },
                    lastExecutedAt: new Date()
                }
            });
        }
    } catch (err) {
        console.error('[Automation Engine] Error:', err.message);
    }
}

async function checkTrigger(automation, msg) {
    const config = automation.triggerConfig || {};

    switch (automation.triggerType) {
        case 'new_message_received':
            return !msg.fromMe;

        case 'keyword_match': {
            const keywords = config.keywords || [];
            const matchType = config.match_type || 'contains';
            const body = (msg.body || '').toLowerCase();
            return keywords.some(kw => {
                const k = kw.toLowerCase();
                return matchType === 'exact' ? body === k : body.includes(k);
            });
        }

        case 'new_contact_created': {
            // Check if this is a first-time contact
            const phone = msg.from;
            const count = await prisma.contact.count({ where: { phone } });
            return count === 0 && !msg.fromMe;
        }

        default:
            return false;
    }
}

async function executeSteps(client, msg, steps) {
    if (!Array.isArray(steps)) return;

    for (const step of steps) {
        try {
            await executeStep(client, msg, step);
            // Small delay between steps to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            console.error(`[Automation] Step "${step.step_type}" failed:`, err.message);
        }
    }
}

async function executeStep(client, msg, step) {
    const cfg = step.step_config || {};

    switch (step.step_type) {
        case 'send_message':
            if (cfg.text) {
                await client.sendMessage(msg.from, cfg.text);
                console.log(`[Automation] Sent message to ${msg.from}`);
            }
            break;

        case 'add_tag': {
            if (!cfg.tag_id) break;
            const contact = await prisma.contact.findFirst({ where: { phone: msg.from } });
            if (contact) {
                await prisma.contactTag.upsert({
                    where: { contactId_tagId: { contactId: contact.id, tagId: cfg.tag_id } },
                    update: {},
                    create: { contactId: contact.id, tagId: cfg.tag_id }
                });
                console.log(`[Automation] Added tag ${cfg.tag_id} to ${msg.from}`);
            }
            break;
        }

        case 'remove_tag': {
            if (!cfg.tag_id) break;
            const contact = await prisma.contact.findFirst({ where: { phone: msg.from } });
            if (contact) {
                await prisma.contactTag.deleteMany({
                    where: { contactId: contact.id, tagId: cfg.tag_id }
                });
            }
            break;
        }

        case 'wait':
            const ms = (cfg.amount || 1) * (cfg.unit === 'minutes' ? 60000 : cfg.unit === 'seconds' ? 1000 : 3600000);
            await new Promise(r => setTimeout(r, Math.min(ms, 30000))); // cap at 30s in-process
            break;

        case 'condition': {
            // Evaluate Yes/No branches
            const conditionMet = await evaluateCondition(msg, cfg);
            const branch = conditionMet ? (step.branches?.yes || []) : (step.branches?.no || []);
            await executeSteps(client, msg, branch);
            break;
        }

        default:
            console.log(`[Automation] Unknown step type: ${step.step_type}`);
    }
}

async function evaluateCondition(msg, cfg) {
    switch (cfg.subject) {
        case 'tag_presence': {
            const contact = await prisma.contact.findFirst({
                where: { phone: msg.from },
                include: { tags: true }
            });
            return contact?.tags?.some(t => t.tagId === cfg.operand) ?? false;
        }
        case 'message_contains':
            return (msg.body || '').toLowerCase().includes((cfg.value || '').toLowerCase());
        default:
            return false;
    }
}

module.exports = { evaluateAutomations };
