-- Thread contact_messages into conversations: existing rows are all inbound
-- (customer → us); admin replies are inserted as 'outbound'. Conversations are
-- grouped by the customer's email in Admin → Messages.
alter table contact_messages add column if not exists direction text not null default 'inbound';
alter table contact_messages drop constraint if exists contact_messages_direction_check;
alter table contact_messages add constraint contact_messages_direction_check check (direction in ('inbound','outbound'));
