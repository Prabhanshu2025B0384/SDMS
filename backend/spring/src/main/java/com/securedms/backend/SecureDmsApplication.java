package com.securedms.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class SecureDmsApplication {
    public static void main(String[] args) {
        SpringApplication.run(SecureDmsApplication.class, args);
    }
}
