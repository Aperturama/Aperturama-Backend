CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    password VARCHAR(255)
);

CREATE TABLE media (
    media_id SERIAL PRIMARY KEY,
    owner_user_id INT,
    date_uploaded DATE,
    date_taken DATE,
    filename VARCHAR(255),
    hash VARCHAR(255),
    FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
);

CREATE TABLE collections (
    collection_id SERIAL PRIMARY KEY,
    owner_user_id INT,
    name VARCHAR(255),
    FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
);

CREATE TABLE collection_media (
    media_id INT,
    collection_id INT,
    PRIMARY KEY (media_id, collection_id),
    FOREIGN KEY (media_id) REFERENCES media(media_id),
    FOREIGN KEY (collection_id) REFERENCES collections(collection_id)
);

CREATE TABLE collection_sharing (
    collection_id INT,
    shared_to_user_id INT,
    shared_link_code VARCHAR(255),
    shared_link_password VARCHAR(255),
    permissions VARCHAR(255),
    PRIMARY KEY (collection_id, shared_to_user_id, shared_link_code),
    FOREIGN KEY (shared_to_user_id) REFERENCES users(user_id),
    FOREIGN KEY (collection_id) REFERENCES collections(collection_id)
);

CREATE TABLE media_sharing (
    media_id INT,
    shared_to_user_id INT,
    shared_link_code VARCHAR(255),
    shared_link_password VARCHAR(255),
    PRIMARY KEY (media_id, shared_to_user_id, shared_link_code),
    FOREIGN KEY (media_id) REFERENCES media(media_id),
    FOREIGN KEY (shared_to_user_id) REFERENCES users(user_id)
);
