package com.securedms.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class StorageService {

    @Value("${storage.supabase.url}")
    private String supabaseUrl;

    @Value("${storage.supabase.key}")
    private String supabaseKey;

    @Value("${storage.supabase.bucket}")
    private String supabaseBucket;

    private final RestTemplate restTemplate = new RestTemplate();

    public void saveStorageFile(String relativePath, byte[] fileBytes) {
        String url = supabaseUrl + "/storage/v1/object/" + supabaseBucket + "/" + relativePath;

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(supabaseKey);
        headers.set("apikey", supabaseKey);
        headers.set("Content-Type", "application/pdf");

        HttpEntity<byte[]> requestEntity = new HttpEntity<>(fileBytes, headers);

        try {
            restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
        } catch (Exception ex) {
            // If it already exists, Supabase POST might fail with 400 Duplicate, so try PUT (Upsert)
            try {
                headers.set("x-upsert", "true");
                HttpEntity<byte[]> upsertEntity = new HttpEntity<>(fileBytes, headers);
                restTemplate.exchange(url, HttpMethod.PUT, upsertEntity, String.class);
            } catch (Exception e2) {
                throw new RuntimeException("Could not store file in Supabase: " + relativePath, e2);
            }
        }
    }

    public byte[] getStorageFile(String relativePath) {
        String url = supabaseUrl + "/storage/v1/object/authenticated/" + supabaseBucket + "/" + relativePath;

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(supabaseKey);
        headers.set("apikey", supabaseKey);

        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.GET, requestEntity, byte[].class);
            return response.getBody();
        } catch (Exception ex) {
            throw new RuntimeException("Could not read file from Supabase: " + relativePath, ex);
        }
    }
}
